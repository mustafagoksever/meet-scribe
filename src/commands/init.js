import chalk from 'chalk';
import { createConfigFile } from '../config.js';

/**
 * meet-scribe init — config dosyası oluştur
 */
export async function handleInit() {
  console.log(chalk.bold.blue('\n🎙  MeetScribe - Kurulum\n'));

  const result = createConfigFile();

  if (result.created) {
    console.log(chalk.green(`✓ Config dosyası oluşturuldu: ${chalk.bold(result.path)}\n`));
    console.log(chalk.dim('Dosyayı düzenleyerek API key ve diğer ayarları gir:'));
    console.log(chalk.white(`  apiKey, baseUrl, llmModel, language, template...\n`));
    console.log(chalk.dim('Zulip entegrasyonu için:'));
    console.log(chalk.white(`  zulipUrl, zulipEmail, zulipApiKey, zulipStream, zulipTopic\n`));
  } else {
    console.log(chalk.yellow(`⚠ Config dosyası zaten mevcut: ${chalk.bold(result.path)}\n`));
  }
}
