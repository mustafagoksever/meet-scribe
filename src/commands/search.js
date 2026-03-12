import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

/**
 * meet-scribe search <query> — search across meetings
 */
export async function handleSearch(query, opts) {
  const outputDir = opts.output || './meet-scribe-output';
  const resolvedDir = path.resolve(outputDir);

  if (!fs.existsSync(resolvedDir)) {
    console.log(chalk.yellow(`\n⚠ Output directory not found: ${resolvedDir}\n`));
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

  const queryLower = query.toLowerCase();
  const results = [];

  for (const file of files) {
    const filePath = path.join(resolvedDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    if (content.toLowerCase().includes(queryLower)) {
      const lines = content.split('\n');
      const matches = [];

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(queryLower)) {
          matches.push({ lineNum: i + 1, text: lines[i].trim() });
        }
      }

      results.push({ file, filePath, matches });
    }
  }

  if (results.length === 0) {
    console.log(chalk.yellow(`\n⚠ No results found for "${query}".\n`));
    return;
  }

  console.log(chalk.bold.blue(`\n🔍 "${query}" — found in ${results.length} meeting(s)\n`));
  console.log(chalk.dim('─'.repeat(60)));

  for (const result of results) {
    console.log(chalk.white.bold(`\n  📄 ${result.file}`));
    console.log(chalk.dim(`     ${result.filePath}`));

    const shownMatches = result.matches.slice(0, 3);
    for (const match of shownMatches) {
      const highlighted = match.text.replace(
        new RegExp(query, 'gi'),
        (m) => chalk.bgYellow.black(m)
      );
      console.log(chalk.dim(`     L${match.lineNum}: `) + highlighted);
    }

    if (result.matches.length > 3) {
      console.log(chalk.dim(`     ... and ${result.matches.length - 3} more matches`));
    }
  }

  console.log(chalk.dim('\n' + '─'.repeat(60)));
  console.log(chalk.dim(`  Total: ${results.length} file(s), ${results.reduce((s, r) => s + r.matches.length, 0)} match(es)\n`));
}
