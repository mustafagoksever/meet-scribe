import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { resolveConfig } from '../config.js';
import { transcribeAudio } from '../stt.js';
import { summarizeTranscript } from '../llm.js';
import { generateMarkdown, saveMarkdown, saveHtml } from '../output.js';
import { printBanner } from '../utils.js';
import { sendNotifications } from '../notify.js';

/**
 * Mevcut ses dosyasını transkript et
 */
export async function handleTranscribe(filePath, opts) {
  const config = resolveConfig(opts);
  const startTime = new Date();

  // Dosya kontrolü
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(chalk.red(`\n✖ Dosya bulunamadı: ${resolvedPath}\n`));
    process.exit(1);
  }

  const sizeMB = (fs.statSync(resolvedPath).size / (1024 * 1024)).toFixed(1);

  printBanner('Dosya Transkripsiyonu');
  console.log(chalk.dim(`  Dosya: ${resolvedPath}`));
  console.log(chalk.dim(`  Boyut: ${sizeMB} MB`));
  console.log(chalk.dim(`  Model: ${config.sttModel} | Şablon: ${config.template}\n`));

  // STT
  const transcript = await runWithSpinner(
    'Ses dosyası transkript ediliyor...',
    async () => transcribeAudio(resolvedPath, config),
    (result) => `Transkript tamamlandı (${result.length} karakter)`,
  );

  console.log(chalk.dim('\n─── Transkript ───\n'));
  console.log(chalk.white(transcript));
  console.log(chalk.dim('\n──────────────────\n'));

  // LLM özet
  let analysis = null;
  if (config.summary) {
    try {
      analysis = await runWithSpinner(
        'LLM ile özet oluşturuluyor...',
        async () => summarizeTranscript(transcript, config),
        () => 'Özet oluşturuldu',
      );

      console.log(chalk.dim('\n─── Özet ───\n'));
      console.log(chalk.white(analysis.ozet));
      if (analysis.ana_konular?.length > 0) {
        console.log(chalk.dim('\nAna konular: ') + chalk.white(analysis.ana_konular.join(', ')));
      }
      if (analysis.ton) {
        console.log(chalk.dim('Ton: ') + chalk.white(analysis.ton));
      }
      console.log(chalk.dim('\n──────────────\n'));
    } catch (err) {
      console.error(chalk.yellow(`⚠ Özet hatası: ${err.message}`));
    }
  }

  // Markdown kaydet
  const transcriptLines = transcript.split('\n').filter(l => l.trim());
  const markdown = generateMarkdown(transcriptLines, analysis, startTime);
  const savedPath = saveMarkdown(markdown, config.output);
  console.log(chalk.green(`✓ Rapor kaydedildi: ${chalk.bold(savedPath)}`));

  // HTML export
  if (config.format === 'html' || config.format === 'both') {
    const htmlPath = saveHtml(markdown, config.output);
    console.log(chalk.green(`✓ HTML: ${chalk.bold(htmlPath)}`));
  }

  // Bildirimler (Zulip / Webhook)
  if (config.zulipUrl || config.webhook) {
    await sendNotifications(config, analysis, markdown);
  }

  console.log();
}

/**
 * Spinner ile async işlem çalıştır
 */
async function runWithSpinner(text, fn, successMsg) {
  const spinner = ora({ text, color: 'cyan' }).start();
  try {
    const result = await fn();
    spinner.succeed(typeof successMsg === 'function' ? successMsg(result) : successMsg);
    return result;
  } catch (err) {
    spinner.fail(`Hata: ${err.message}`);
    throw err;
  }
}
