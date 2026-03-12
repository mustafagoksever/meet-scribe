import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

/**
 * meet-scribe actions — list open action items
 */
export async function handleActions(opts) {
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

  const allActions = [];

  for (const file of files) {
    const filePath = path.join(resolvedDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    const dateMatch = content.match(/\*\*Date:\*\*\s*(.+)/);
    const date = dateMatch ? dateMatch[1].trim() : file;

    // Find open action items: - [ ]
    for (const line of lines) {
      const match = line.match(/^- \[ \]\s+(.+)/);
      if (match) {
        const text = match[1].trim();
        const ownerMatch = text.match(/(.+?)\s*→\s*(.+)/);

        allActions.push({
          item: ownerMatch ? ownerMatch[1].trim() : text,
          owner: ownerMatch ? ownerMatch[2].trim() : null,
          date,
          file,
        });
      }
    }
  }

  // Count completed actions: - [x]
  let completedCount = 0;
  for (const file of files) {
    const content = fs.readFileSync(path.join(resolvedDir, file), 'utf-8');
    const matches = content.match(/^- \[x\]/gm);
    if (matches) completedCount += matches.length;
  }

  if (allActions.length === 0) {
    console.log(chalk.green('\n✓ All action items completed! 🎉\n'));
    return;
  }

  console.log(chalk.bold.blue(`\n📋 Open Action Items (${allActions.length} open, ${completedCount} completed)\n`));
  console.log(chalk.dim('─'.repeat(60)));

  // Group by owner
  const byOwner = {};
  for (const action of allActions) {
    const key = action.owner || '(unassigned)';
    if (!byOwner[key]) byOwner[key] = [];
    byOwner[key].push(action);
  }

  for (const [owner, actions] of Object.entries(byOwner)) {
    console.log(chalk.bold.white(`\n  👤 ${owner}`));

    for (const action of actions) {
      console.log(
        chalk.red('  ☐ ') +
        chalk.white(action.item) +
        chalk.dim(` (${action.date})`)
      );
    }
  }

  console.log(chalk.dim('\n' + '─'.repeat(60)));
  console.log(chalk.dim(`  Open: ${allActions.length} | Completed: ${completedCount}\n`));
}
