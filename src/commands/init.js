import chalk from 'chalk';
import { createConfigFile } from '../config.js';

/**
 * meet-scribe init — create config file
 */
export async function handleInit() {
  console.log(chalk.bold.blue('\n🎙  MeetScribe - Setup\n'));

  const result = createConfigFile();

  if (result.created) {
    console.log(chalk.green(`✓ Config file created: ${chalk.bold(result.path)}\n`));
    console.log(chalk.dim('Edit the file to set your API key and other settings:'));
    console.log(chalk.white(`  apiKey, baseUrl, llmModel, language, template...\n`));
    console.log(chalk.dim('For Zulip integration:'));
    console.log(chalk.white(`  zulipUrl, zulipEmail, zulipApiKey, zulipStream, zulipTopic\n`));
  } else {
    console.log(chalk.yellow(`⚠ Config file already exists: ${chalk.bold(result.path)}\n`));
  }
}
