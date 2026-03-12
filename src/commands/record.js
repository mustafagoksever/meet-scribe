import { spawn } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import { resolveConfig } from '../config.js';
import { transcribeBuffer } from '../stt.js';
import { summarizeTranscript } from '../llm.js';
import { generateMarkdown, saveMarkdown, saveHtml } from '../output.js';
import { exitIfNoFfmpeg, addWavHeader, calculateRMS, formatTime, printBanner } from '../utils.js';
import { detectAudioDevice } from '../audio-detect.js';
import { sendNotifications } from '../notify.js';

// Konuşmacı renkleri — sınırsız konuşmacı desteği, renkler döngüsel
const SPEAKER_COLORS = [
  chalk.cyan.bold,
  chalk.green.bold,
  chalk.magenta.bold,
  chalk.yellow.bold,
  chalk.blue.bold,
  chalk.red.bold,
  chalk.whiteBright.bold,
  chalk.greenBright.bold,
  chalk.cyanBright.bold,
  chalk.magentaBright.bold,
];

function getSpeaker(index) {
  return {
    label: `K${index}`,
    color: SPEAKER_COLORS[index % SPEAKER_COLORS.length],
  };
}

/**
 * Mikrofon + sistem sesi kaydı (ffmpeg loopback ile)
 */
export async function handleRecord(opts) {
  const config = resolveConfig(opts);
  const { chunk: chunkDuration } = config;
  const startTime = new Date();

  exitIfNoFfmpeg();
  printBanner('Toplantı Kaydı');

  const audioArgs = detectAudioDevice();
  if (!audioArgs) process.exit(1);

  console.log(chalk.green(`✓ Ses kaynağı: ${audioArgs.deviceName}`));
  console.log(chalk.dim(`  Chunk: ${chunkDuration}s | Model: ${config.sttModel} | Şablon: ${config.template}`));
  console.log(chalk.dim(`  Durdurmak: Ctrl+C | Duraklatma: Space\n`));

  const recorder = new AudioRecorder(config, audioArgs, chunkDuration, startTime);
  recorder.start();
}

/**
 * Ses kaydı yönetici sınıfı
 */
class AudioRecorder {
  constructor(config, audioArgs, chunkDuration, startTime) {
    this.config = config;
    this.audioArgs = audioArgs;
    this.chunkDuration = chunkDuration;
    this.startTime = startTime;

    this.transcriptLines = [];
    this.chunkIndex = 0;
    this.chunkStartTime = 0;
    this.isRecording = true;
    this.isPaused = false;
    this.currentBuffer = Buffer.alloc(0);
    this.headerSkipped = false;
    this.headerBuffer = Buffer.alloc(0);
  }

  start() {
    this._spawnFfmpeg();
    this._startChunkTimer();
    this._registerSignals();
    this._registerKeypress();
  }

  // ── ffmpeg süreci ──────────────────────

  _spawnFfmpeg() {
    const args = [...this.audioArgs.args];

    // Gürültü filtreleme
    if (this.config.noiseFilter) {
      args.push('-af', 'highpass=f=80,lowpass=f=8000,anlmdn=s=7:p=0.002:r=0.015');
    }

    args.push(
      '-ar', '16000',
      '-ac', '1',
      '-f', 'wav',
      '-fragment_size', '4096',
      'pipe:1',
    );

    this.ffmpeg = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });

    let stderr = '';
    this.ffmpeg.stderr.on('data', (d) => { stderr += d.toString(); });

    this.ffmpeg.on('error', (err) => {
      console.error(chalk.red(`\n✖ ffmpeg başlatılamadı: ${err.message}`));
      if (stderr) console.error(chalk.dim(stderr.slice(-500)));
      process.exit(1);
    });

    this.ffmpeg.stdout.on('data', (data) => this._onAudioData(data));
  }

  _onAudioData(data) {
    if (this.isPaused) return; // Duraklatıldıysa buffer'a ekleme

    if (!this.headerSkipped) {
      this.headerBuffer = Buffer.concat([this.headerBuffer, data]);
      if (this.headerBuffer.length >= 44) {
        const remaining = this.headerBuffer.subarray(44);
        if (remaining.length > 0) {
          this.currentBuffer = Buffer.concat([this.currentBuffer, remaining]);
        }
        this.headerSkipped = true;
      }
      return;
    }
    this.currentBuffer = Buffer.concat([this.currentBuffer, data]);
  }

  // ── Pause / Resume ────────────────────

  _registerKeypress() {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', (key) => {
        // Space = durakla/devam
        if (key.toString() === ' ') {
          this.isPaused = !this.isPaused;
          if (this.isPaused) {
            console.log(chalk.yellow('\n⏸  Duraklatıldı — Space ile devam et'));
          } else {
            console.log(chalk.green('▶  Devam ediliyor...\n'));
          }
        }
        // Ctrl+C
        if (key[0] === 3) {
          this._cleanup();
        }
      });
    }
  }

  // ── Chunk zamanlayıcı ──────────────────

  _startChunkTimer() {
    this.chunkInterval = setInterval(async () => {
      if (!this.isRecording || this.isPaused || this.currentBuffer.length === 0) return;

      const buffer = this.currentBuffer;
      this.currentBuffer = Buffer.alloc(0);

      await this._processChunk(buffer);
      this.chunkStartTime += this.chunkDuration;
      this.chunkIndex++;
    }, this.chunkDuration * 1000);
  }

  // ── Chunk işleme ───────────────────────

  async _processChunk(rawBuffer) {
    const wavBuffer = addWavHeader(rawBuffer);
    const rms = calculateRMS(rawBuffer);
    const time = formatTime(this.chunkStartTime);

    if (rms < 0.005) {
      console.log(chalk.dim(`  [${time}] (sessiz - atlanıyor)`));
      return;
    }

    const spinner = ora({
      text: chalk.dim(`[${time}] Transkript ediliyor...`),
      color: 'yellow',
    }).start();

    try {
      const text = await transcribeBuffer(wavBuffer, this.config, this.chunkIndex);

      if (!text?.trim()) {
        spinner.stop();
        console.log(chalk.dim(`  [${time}] (boş transkript)`));
        return;
      }

      spinner.stop();

      const speaker = getSpeaker(this.chunkIndex);
      const line = `[${time}] [${speaker.label}]: ${text}`;
      this.transcriptLines.push(line);

      console.log(
        chalk.dim(`[${time}] `) +
        speaker.color(`[${speaker.label}]: `) +
        chalk.white(text)
      );
    } catch (err) {
      spinner.fail(`STT hatası: ${err.message}`);
    }
  }

  // ── Ctrl+C & cleanup ──────────────────

  _registerSignals() {
    const cleanup = () => this._cleanup();
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }

  async _cleanup() {
    if (!this.isRecording) return;
    this.isRecording = false;
    clearInterval(this.chunkInterval);

    // Restore terminal
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }

    console.log(chalk.yellow('\n\n⏹  Kayıt durduruluyor...'));

    this.ffmpeg.stdin.write('q');
    this.ffmpeg.kill('SIGTERM');

    if (this.currentBuffer.length > 0) {
      await this._processChunk(this.currentBuffer);
    }

    await this._saveResults();
    process.exit(0);
  }

  async _saveResults() {
    const { transcriptLines, config, startTime } = this;

    if (transcriptLines.length === 0) {
      console.log(chalk.yellow('\n⚠ Transkript boş, dosya kaydedilmedi.'));
      return;
    }

    // LLM özet
    let analysis = null;
    if (config.summary) {
      const spinner = ora({ text: 'LLM ile özet oluşturuluyor...', color: 'cyan' }).start();
      try {
        analysis = await summarizeTranscript(transcriptLines.join('\n'), config);
        spinner.succeed('Özet oluşturuldu');
      } catch (err) {
        spinner.fail(`Özet hatası: ${err.message}`);
      }
    }

    const markdown = generateMarkdown(transcriptLines, analysis, startTime);
    const savedPath = saveMarkdown(markdown, config.output);

    const icon = analysis ? '✓' : '⚠';
    const label = analysis ? 'Rapor kaydedildi' : 'Transkript kaydedildi (özetlenmedi)';
    const color = analysis ? chalk.green : chalk.yellow;
    console.log(color(`\n${icon} ${label}: ${chalk.bold(savedPath)}`));

    // HTML export
    if (config.format === 'html' || config.format === 'both') {
      const htmlPath = saveHtml(markdown, config.output);
      console.log(chalk.green(`✓ HTML: ${chalk.bold(htmlPath)}`));
    }

    // Bildirimler (Zulip / Webhook)
    if (config.zulipUrl || config.webhook) {
      const spinner = ora({ text: 'Bildirimler gönderiliyor...', color: 'cyan' }).start();
      try {
        await sendNotifications(config, analysis, markdown);
        spinner.stop();
      } catch {
        spinner.stop();
      }
    }
  }
}
