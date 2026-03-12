import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

/**
 * meet-scribe list — list recent meetings
 */
export async function handleList(opts) {
  const outputDir = opts.output || './meet-scribe-output';
  const resolvedDir = path.resolve(outputDir);

  if (!fs.existsSync(resolvedDir)) {
    console.log(chalk.yellow(`\n⚠ Output directory not found: ${resolvedDir}\n`));
    console.log(chalk.dim('No meetings recorded yet.'));
    return;
  }

  const files = fs.readdirSync(resolvedDir)
    .filter(f => f.startsWith('meeting_') && f.endsWith('.md'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.log(chalk.yellow('\n⚠ No meeting files found.\n'));
    return;
  }

  const count = parseInt(opts.count, 10) || 10;
  const shown = files.slice(0, count);

  console.log(chalk.bold.blue(`\n📋 Last ${shown.length} Meeting(s)\n`));
  console.log(chalk.dim('─'.repeat(60)));

  for (const file of shown) {
    const filePath = path.join(resolvedDir, file);
    const stat = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');

    const dateMatch = content.match(/\*\*Date:\*\*\s*(.+)/);
    const durMatch = content.match(/\*\*Duration:\*\*\s*(.+)/);
    const toneMatch = content.match(/\*\*Tone:\*\*\s*(.+)/);

    const date = dateMatch ? dateMatch[1].trim() : stat.mtime.toLocaleDateString('en-US');
    const dur = durMatch ? durMatch[1].trim() : '?';
    const tone = toneMatch ? toneMatch[1].trim() : '';
    const size = (stat.size / 1024).toFixed(1);

    const toneEmoji = tone === 'positive' ? '😊' : tone === 'tense' ? '😬' : '😐';

    console.log(
      chalk.white(`  ${date}`) +
      chalk.dim(` | ${dur} | ${size}KB ${toneEmoji}`) +
      chalk.dim(`\n  → ${filePath}`)
    );
    console.log(chalk.dim('─'.repeat(60)));
  }

  if (files.length > count) {
    console.log(chalk.dim(`  ... and ${files.length - count} more\n`));
  }
  console.log();
}
