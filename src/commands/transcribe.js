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
 * Transcribe an existing audio file
 */
export async function handleTranscribe(filePath, opts) {
  const config = resolveConfig(opts);
  const startTime = new Date();

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(chalk.red(`\n✖ File not found: ${resolvedPath}\n`));
    process.exit(1);
  }

  const sizeMB = (fs.statSync(resolvedPath).size / (1024 * 1024)).toFixed(1);

  printBanner('File Transcription');
  console.log(chalk.dim(`  File: ${resolvedPath}`));
  console.log(chalk.dim(`  Size: ${sizeMB} MB`));
  console.log(chalk.dim(`  Model: ${config.sttModel} | Template: ${config.template}\n`));

  // STT
  const transcript = await runWithSpinner(
    'Transcribing audio file...',
    async () => transcribeAudio(resolvedPath, config),
    (result) => `Transcription complete (${result.length} chars)`,
  );

  console.log(chalk.dim('\n─── Transcript ───\n'));
  console.log(chalk.white(transcript));
  console.log(chalk.dim('\n──────────────────\n'));

  // LLM summary
  let analysis = null;
  if (config.summary) {
    try {
      analysis = await runWithSpinner(
        'Generating summary with LLM...',
        async () => summarizeTranscript(transcript, config),
        () => 'Summary generated',
      );

      console.log(chalk.dim('\n─── Summary ───\n'));
      console.log(chalk.white(analysis.summary));
      if (analysis.key_topics?.length > 0) {
        console.log(chalk.dim('\nKey topics: ') + chalk.white(analysis.key_topics.join(', ')));
      }
      if (analysis.tone) {
        console.log(chalk.dim('Tone: ') + chalk.white(analysis.tone));
      }
      console.log(chalk.dim('\n──────────────\n'));
    } catch (err) {
      console.error(chalk.yellow(`⚠ Summary error: ${err.message}`));
    }
  }

  // Save markdown
  const transcriptLines = transcript.split('\n').filter(l => l.trim());
  const markdown = generateMarkdown(transcriptLines, analysis, startTime);
  const savedPath = saveMarkdown(markdown, config.output);
  console.log(chalk.green(`✓ Report saved: ${chalk.bold(savedPath)}`));

  // HTML export
  if (config.format === 'html' || config.format === 'both') {
    const htmlPath = saveHtml(markdown, config.output);
    console.log(chalk.green(`✓ HTML: ${chalk.bold(htmlPath)}`));
  }

  // Notifications (Zulip / Webhook)
  if (config.zulipUrl || config.webhook) {
    await sendNotifications(config, analysis, markdown);
  }

  console.log();
}

/**
 * Run async task with spinner
 */
async function runWithSpinner(text, fn, successMsg) {
  const spinner = ora({ text, color: 'cyan' }).start();
  try {
    const result = await fn();
    spinner.succeed(typeof successMsg === 'function' ? successMsg(result) : successMsg);
    return result;
  } catch (err) {
    spinner.fail(`Error: ${err.message}`);
    throw err;
  }
}
