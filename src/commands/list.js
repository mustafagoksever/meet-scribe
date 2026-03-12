import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

/**
 * meet-scribe list — son toplantıları listele
 */
export async function handleList(opts) {
  const outputDir = opts.output || './meet-scribe-output';
  const resolvedDir = path.resolve(outputDir);

  if (!fs.existsSync(resolvedDir)) {
    console.log(chalk.yellow(`\n⚠ Çıktı dizini bulunamadı: ${resolvedDir}\n`));
    console.log(chalk.dim('Henüz toplantı kaydedilmemiş.'));
    return;
  }

  const files = fs.readdirSync(resolvedDir)
    .filter(f => f.startsWith('toplanti_') && f.endsWith('.md'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.log(chalk.yellow('\n⚠ Toplantı dosyası bulunamadı.\n'));
    return;
  }

  const count = parseInt(opts.count, 10) || 10;
  const shown = files.slice(0, count);

  console.log(chalk.bold.blue(`\n📋 Son ${shown.length} Toplantı\n`));
  console.log(chalk.dim('─'.repeat(60)));

  for (const file of shown) {
    const filePath = path.join(resolvedDir, file);
    const stat = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Tarih ve süre bilgisini dosyadan çek
    const dateMatch = content.match(/\*\*Tarih:\*\*\s*(.+)/);
    const sureMatch = content.match(/\*\*Süre:\*\*\s*(.+)/);
    const tonMatch = content.match(/\*\*Ton:\*\*\s*(.+)/);

    const date = dateMatch ? dateMatch[1].trim() : stat.mtime.toLocaleDateString('tr-TR');
    const sure = sureMatch ? sureMatch[1].trim() : '?';
    const ton = tonMatch ? tonMatch[1].trim() : '';
    const size = (stat.size / 1024).toFixed(1);

    const tonEmoji = ton === 'olumlu' ? '😊' : ton === 'gergin' ? '😬' : '😐';

    console.log(
      chalk.white(`  ${date}`) +
      chalk.dim(` | ${sure} | ${size}KB ${tonEmoji}`) +
      chalk.dim(`\n  → ${filePath}`)
    );
    console.log(chalk.dim('─'.repeat(60)));
  }

  if (files.length > count) {
    console.log(chalk.dim(`  ... ve ${files.length - count} toplantı daha\n`));
  }
  console.log();
}
