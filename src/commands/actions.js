import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

/**
 * meet-scribe actions — tamamlanmamış aksiyon maddelerini listele
 */
export async function handleActions(opts) {
  const outputDir = opts.output || './meet-scribe-output';
  const resolvedDir = path.resolve(outputDir);

  if (!fs.existsSync(resolvedDir)) {
    console.log(chalk.yellow(`\n⚠ Çıktı dizini bulunamadı: ${resolvedDir}\n`));
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

  const allActions = [];

  for (const file of files) {
    const filePath = path.join(resolvedDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Tarih bilgisi
    const dateMatch = content.match(/\*\*Tarih:\*\*\s*(.+)/);
    const date = dateMatch ? dateMatch[1].trim() : file;

    // Tamamlanmamış aksiyonları bul: - [ ]
    for (const line of lines) {
      const match = line.match(/^- \[ \]\s+(.+)/);
      if (match) {
        const text = match[1].trim();
        const ownerMatch = text.match(/(.+?)\s*→\s*(.+)/);

        allActions.push({
          madde: ownerMatch ? ownerMatch[1].trim() : text,
          sahip: ownerMatch ? ownerMatch[2].trim() : null,
          date,
          file,
        });
      }
    }
  }

  // Tamamlanmış aksiyonları say: - [x]
  let completedCount = 0;
  for (const file of files) {
    const content = fs.readFileSync(path.join(resolvedDir, file), 'utf-8');
    const matches = content.match(/^- \[x\]/gm);
    if (matches) completedCount += matches.length;
  }

  if (allActions.length === 0) {
    console.log(chalk.green('\n✓ Tüm aksiyon maddeleri tamamlanmış! 🎉\n'));
    return;
  }

  console.log(chalk.bold.blue(`\n📋 Açık Aksiyon Maddeleri (${allActions.length} açık, ${completedCount} tamamlanmış)\n`));
  console.log(chalk.dim('─'.repeat(60)));

  // Kişiye göre grupla
  const byOwner = {};
  for (const action of allActions) {
    const key = action.sahip || '(atanmamış)';
    if (!byOwner[key]) byOwner[key] = [];
    byOwner[key].push(action);
  }

  for (const [owner, actions] of Object.entries(byOwner)) {
    console.log(chalk.bold.white(`\n  👤 ${owner}`));

    for (const action of actions) {
      console.log(
        chalk.red('  ☐ ') +
        chalk.white(action.madde) +
        chalk.dim(` (${action.date})`)
      );
    }
  }

  console.log(chalk.dim('\n' + '─'.repeat(60)));
  console.log(chalk.dim(`  Açık: ${allActions.length} | Tamamlanmış: ${completedCount}\n`));
}
