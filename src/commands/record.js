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
import { startWebServer, broadcastMessage, webEvents } from '../web.js';

// Speaker colors — unlimited speaker support, colors cycle
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

const SPEAKER_COLOR_NAMES = [
  'cyan', 'green', 'magenta', 'yellow', 'blue', 'red', 'white', 'greenBright', 'cyanBright', 'magentaBright'
];

/**
 * Get speaker info by index
 * Uses energy-based heuristic: significant silence gaps suggest speaker change
 */
function getSpeaker(index) {
  const colorIdx = index % SPEAKER_COLORS.length;
  return {
    label: `S${index}`,
    color: SPEAKER_COLORS[colorIdx],
    colorName: SPEAKER_COLOR_NAMES[colorIdx],
  };
}

/**
 * Record mic + system audio (ffmpeg loopback)
 */
export async function handleRecord(opts) {
  const config = resolveConfig(opts);
  const { chunk: chunkDuration } = config;
  const startTime = new Date();

  exitIfNoFfmpeg();
  printBanner('Meeting Recording');

  const audioArgs = detectAudioDevice();
  if (!audioArgs) process.exit(1);

  console.log(chalk.green(`✓ Audio source: ${audioArgs.deviceName}`));
  console.log(chalk.dim(`  Chunk: ${chunkDuration}s | Model: ${config.sttModel} | Template: ${config.template}`));
  console.log(chalk.dim(`  Stop: Ctrl+C | Pause: Space\n`));

  if (config.web) {
    startWebServer(config.webPort, config);

    // Wait for web client to send start with template selection
    console.log(chalk.cyan('⏳ Waiting for start command from Web Dashboard...'));
    console.log(chalk.dim('   Open the dashboard and select a meeting template to begin.\n'));

    const startData = await new Promise((resolve) => {
      // Also allow Ctrl+C to exit while waiting
      const handleExit = () => process.exit(0);
      process.on('SIGINT', handleExit);

      webEvents.once('start', (data) => {
        process.removeListener('SIGINT', handleExit);
        resolve(data);
      });
    });

    // Apply template and language from web selection
    if (startData.template) {
      config.template = startData.template;
      config.lang = startData.lang || 'tr';
      console.log(chalk.green(`✓ Template selected: ${config.template} [${config.lang}]`));
    }
  }

  const recorder = new AudioRecorder(config, audioArgs, chunkDuration, startTime);
  recorder.start();
}

/**
 * Audio recording manager class
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

    // Speaker tracking
    this.currentSpeaker = 0;
    this.lastRMS = 0;
    this.silenceCount = 0;
    this.speakerChangeThreshold = 3; // consecutive silence chunks before considering speaker change
  }

  start() {
    if (this.config.web) {
      broadcastMessage('status', 'Recording started');
    }
    
    this._spawnFfmpeg();
    this._startChunkTimer();
    this._registerSignals();
    this._registerKeypress();
  }

  // ── ffmpeg process ─────────────────────

  _spawnFfmpeg() {
    const args = [...this.audioArgs.args];

    // Noise filtering
    if (this.config.noiseFilter) {
      args.push('-af', 'highpass=f=80,lowpass=f=8000,anlmdn=s=7:p=0.002:r=0.015');
    }

    args.push(
      '-ar', '16000',
      '-ac', '1',
      '-f', 'wav',
      'pipe:1',
    );

    this.ffmpeg = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });

    let stderr = '';
    this.ffmpeg.stderr.on('data', (d) => { stderr += d.toString(); });

    this.ffmpeg.on('error', (err) => {
      console.error(chalk.red(`\n✖ Could not start ffmpeg: ${err.message}`));
      if (stderr) console.error(chalk.dim(stderr.slice(-500)));
      process.exit(1);
    });

    this.ffmpeg.stdout.on('data', (data) => this._onAudioData(data));
  }

  _onAudioData(data) {
    if (this.isPaused) return; // Skip buffering when paused
    this.currentBuffer = Buffer.concat([this.currentBuffer, data]);
  }

  // ── Pause / Resume ────────────────────

  _registerKeypress() {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', (key) => {
        // Space = pause/resume
        if (key.toString() === ' ') {
          this.isPaused = !this.isPaused;
          if (this.isPaused) {
            console.log(chalk.yellow('\n⏸  Paused — press Space to resume'));
            if (this.config.web) broadcastMessage('pause');
          } else {
            console.log(chalk.green('▶  Resuming...\n'));
            if (this.config.web) broadcastMessage('resume');
          }
        }
        // Ctrl+C
        if (key[0] === 3) {
          this._cleanup();
        }
      });
    }
  }

  // ── Chunk timer ────────────────────────

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

  // ── Speaker detection (energy-based heuristic) ───────

  _detectSpeakerChange(rms) {
    // If there was a significant silence gap, consider it a speaker change
    if (this.lastRMS < 0.001 && rms > 0.005) {
      this.silenceCount++;
      if (this.silenceCount >= this.speakerChangeThreshold) {
        this.currentSpeaker++;
        this.silenceCount = 0;
      }
    }

    // If energy profile changes dramatically, possible speaker change
    if (this.lastRMS > 0 && rms > 0) {
      const ratio = rms / this.lastRMS;
      if (ratio > 3.0 || ratio < 0.3) {
        // Significant energy change — potential speaker change
        this.currentSpeaker++;
      }
    }

    this.lastRMS = rms;
    return this.currentSpeaker;
  }

  // ── Chunk processing ───────────────────

  async _processChunk(rawBuffer) {
    const wavBuffer = addWavHeader(rawBuffer);
    const rms = calculateRMS(rawBuffer);
    const time = formatTime(this.chunkStartTime);

    if (rms < 0.0005) {
      console.log(chalk.dim(`  [${time}] (silence — skipping)`));
      this.silenceCount++;
      this.lastRMS = rms;
      return;
    }

    const spinner = ora({
      text: chalk.dim(`[${time}] Transcribing...`),
      color: 'yellow',
    }).start();

    try {
      const text = await transcribeBuffer(wavBuffer, this.config, this.chunkIndex);

      if (!text?.trim()) {
        spinner.stop();
        console.log(chalk.dim(`  [${time}] (empty transcript)`));
        return;
      }

      spinner.stop();

      // Detect speaker based on audio energy changes
      const speakerIdx = this._detectSpeakerChange(rms);
      const speaker = getSpeaker(speakerIdx);
      const line = `[${time}] [${speaker.label}]: ${text}`;
      this.transcriptLines.push(line);

      console.log(
        chalk.dim(`[${time}] `) +
        speaker.color(`[${speaker.label}]: `) +
        chalk.white(text)
      );

      if (this.config.web) {
        broadcastMessage('transcript', {
          time,
          speakerLabel: speaker.label,
          speakerColor: speaker.colorName,
          text,
        });
      }
    } catch (err) {
      spinner.fail(`STT error: ${err.message}`);
      if (err.message.includes('401') || err.message.includes('403') || err.message.includes('invalid_api_key')) {
        console.error(chalk.red('\n✖ Invalid API Key! Stopping recording.'));
        if (this.config.web) {
          broadcastMessage('error', 'API Anahtarı Geçersiz (401 Unauthorized). Lütfen .meetscriberc dosyanızdaki apiKey değerini kontrol edin.');
        }
        this._cleanup();
      }
    }
  }

  // ── Ctrl+C & cleanup ──────────────────

  _registerSignals() {
    const handleExit = () => {
      if (!this.isRecording) {
        // Second Ctrl+C -> force exit
        process.exit(0);
      } else {
        this._cleanup();
      }
    };
    process.on('SIGINT', handleExit);
    process.on('SIGTERM', handleExit);

    if (this.config.web) {
      webEvents.on('pause', () => {
        if (!this.isPaused) {
          this.isPaused = true;
          console.log(chalk.yellow('\n⏸  [Web] Paused'));
          broadcastMessage('pause');
        }
      });
      webEvents.on('resume', () => {
        if (this.isPaused) {
          this.isPaused = false;
          console.log(chalk.green('▶  [Web] Resuming...\n'));
          broadcastMessage('resume');
        }
      });
      webEvents.on('stop', () => {
        console.log(chalk.yellow('\n⏹  [Web] Stop requested'));
        this._cleanup();
      });
    }
  }

  async _cleanup() {
    if (!this.isRecording) return;
    this.isRecording = false;
    clearInterval(this.chunkInterval);

    // Restore terminal
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }

    console.log(chalk.yellow('\n\n⏹  Stopping recording...'));
    if (this.config.web) broadcastMessage('end');

    this.ffmpeg.stdin.write('q');
    this.ffmpeg.kill('SIGTERM');

    if (this.currentBuffer.length > 0) {
      await this._processChunk(this.currentBuffer);
    }

    await this._saveResults();
    
    if (this.config.web) {
      console.log(chalk.cyan('\n🌐 Web Dashboard is still active. Press Ctrl+C again to exit the CLI.'));
    } else {
      process.exit(0);
    }
  }

  async _saveResults() {
    const { transcriptLines, config, startTime } = this;

    if (transcriptLines.length === 0) {
      console.log(chalk.yellow('\n⚠ Transcript is empty, no file saved.'));
      return;
    }

    // LLM summary
    let analysis = null;
    if (config.summary) {
      const spinner = ora({ text: 'Generating summary with LLM...', color: 'cyan' }).start();
      try {
        analysis = await summarizeTranscript(transcriptLines.join('\n'), config);
        spinner.succeed('Summary generated');
        if (config.web) broadcastMessage('summary', analysis);
      } catch (err) {
        spinner.fail(`Summary error: ${err.message}`);
      }
    }

    const markdown = generateMarkdown(transcriptLines, analysis, startTime, config.lang || 'tr');
    const savedPath = saveMarkdown(markdown, config.output);

    const icon = analysis ? '✓' : '⚠';
    const label = analysis ? 'Report saved' : 'Transcript saved (no summary)';
    const color = analysis ? chalk.green : chalk.yellow;
    console.log(color(`\n${icon} ${label}: ${chalk.bold(savedPath)}`));

    // HTML export
    if (config.format === 'html' || config.format === 'both') {
      const htmlPath = saveHtml(markdown, config.output);
      console.log(chalk.green(`✓ HTML: ${chalk.bold(htmlPath)}`));
    }

    // Notifications (Zulip / Webhook)
    if (config.zulipUrl || config.webhook) {
      const spinner = ora({ text: 'Sending notifications...', color: 'cyan' }).start();
      try {
        await sendNotifications(config, analysis, markdown);
        spinner.stop();
      } catch {
        spinner.stop();
      }
    }
  }
}
