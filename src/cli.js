import { Command } from 'commander';
import { handleRecord } from './commands/record.js';
import { handleTranscribe } from './commands/transcribe.js';
import { handleInit } from './commands/init.js';
import { handleList } from './commands/list.js';
import { handleSearch } from './commands/search.js';
import { handleActions } from './commands/actions.js';
import { listTemplates } from './templates.js';
import chalk from 'chalk';

export function run() {
  const program = new Command();

  program
    .name('meet-scribe')
    .description('Toplantı sesini kayıt eden, transkript eden ve özetleyen CLI aracı')
    .version('2.0.0');

  // Global seçenekler
  program
    .option('--api-key <key>', 'OpenAI API key (OPENAI_API_KEY env)')
    .option('--base-url <url>', 'Custom API base URL (OPENAI_BASE_URL env)')
    .option('--stt-model <model>', 'Whisper model (default: whisper-1)')
    .option('--llm-model <model>', 'LLM model (LLM_MODEL env, default: gpt-4o-mini)')
    .option('--language <lang>', 'Dil kodu (default: auto)')
    .option('--no-summary', 'LLM özetini atla')
    .option('--output <dir>', 'Çıktı dizini (default: ./meet-scribe-output)')
    .option('--chunk <seconds>', 'Record modunda chunk süresi saniye (default: 30)')
    .option('--template <name>', 'Toplantı şablonu (default, standup, retro, decision, oneone)')
    .option('--format <type>', 'Çıktı formatı: md, html (default: md)')
    .option('--webhook <url>', 'Webhook URL (toplantı sonunda POST gönderir)')
    .option('--zulip-url <url>', 'Zulip sunucu URL')
    .option('--zulip-email <email>', 'Zulip bot email')
    .option('--zulip-api-key <key>', 'Zulip API key')
    .option('--zulip-stream <stream>', 'Zulip stream adı')
    .option('--zulip-topic <topic>', 'Zulip topic adı')
    .option('--noise-filter', 'Ses kaydında gürültü filtreleme');

  // init
  program
    .command('init')
    .description('Config dosyası (.meetscriberc) oluştur')
    .action(async () => {
      await handleInit();
    });

  // record
  program
    .command('record')
    .description('Mikrofon + sistem sesini kaydet, gerçek zamanlı transkript et (Space=duraklatma)')
    .action(async () => {
      await handleRecord(program.opts());
    });

  // transcribe
  program
    .command('transcribe <file>')
    .description('Mevcut ses dosyasını transkript et')
    .action(async (file) => {
      await handleTranscribe(file, program.opts());
    });

  // list
  program
    .command('list')
    .description('Son toplantıları listele')
    .option('-n, --count <number>', 'Gösterilecek toplantı sayısı', '10')
    .action(async (cmdOpts) => {
      await handleList({ ...program.opts(), ...cmdOpts });
    });

  // search
  program
    .command('search <query>')
    .description('Toplantılarda arama yap')
    .action(async (query) => {
      await handleSearch(query, program.opts());
    });

  // actions
  program
    .command('actions')
    .description('Tamamlanmamış aksiyon maddelerini listele')
    .action(async () => {
      await handleActions(program.opts());
    });

  // templates
  program
    .command('templates')
    .description('Kullanılabilir toplantı şablonlarını listele')
    .action(() => {
      console.log(chalk.bold.blue('\n📋 Toplantı Şablonları\n'));
      for (const t of listTemplates()) {
        console.log(chalk.white(`  ${chalk.bold(t.key)}`) + chalk.dim(` — ${t.name}`));
      }
      console.log(chalk.dim('\n  Kullanım: meet-scribe record --template standup\n'));
    });

  program.parse();
}
