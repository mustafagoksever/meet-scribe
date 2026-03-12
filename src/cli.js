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
    .description('CLI tool that records meetings, transcribes with Whisper, summarizes with LLM, and generates Markdown')
    .version('2.0.0');

  // Global options
  program
    .option('--api-key <key>', 'OpenAI API key (OPENAI_API_KEY env)')
    .option('--base-url <url>', 'Custom API base URL (OPENAI_BASE_URL env)')
    .option('--stt-model <model>', 'Whisper model (default: whisper-1)')
    .option('--llm-model <model>', 'LLM model (LLM_MODEL env, default: gpt-4o-mini)')
    .option('--language <lang>', 'Language code (default: auto)')
    .option('--no-summary', 'Skip LLM summary')
    .option('--output <dir>', 'Output directory (default: ./meet-scribe-output)')
    .option('--chunk <seconds>', 'Chunk duration in seconds for record mode (default: 30)')
    .option('--template <name>', 'Meeting template (default, standup, retro, decision, oneone)')
    .option('--format <type>', 'Output format: md, html (default: md)')
    .option('--webhook <url>', 'Webhook URL (sends POST on meeting end)')
    .option('--zulip-url <url>', 'Zulip server URL')
    .option('--zulip-email <email>', 'Zulip bot email')
    .option('--zulip-api-key <key>', 'Zulip API key')
    .option('--zulip-stream <stream>', 'Zulip stream name')
    .option('--zulip-topic <topic>', 'Zulip topic name')
    .option('--noise-filter', 'Enable noise filtering during recording')
    .option('--web', 'Start real-time web dashboard')
    .option('--web-port <port>', 'Web dashboard port (default: 3000)');

  // init
  program
    .command('init')
    .description('Create config file (.meetscriberc)')
    .action(async () => {
      await handleInit();
    });

  // record
  program
    .command('record')
    .description('Record mic + system audio, real-time transcription (Space=pause)')
    .action(async () => {
      await handleRecord(program.opts());
    });

  // transcribe
  program
    .command('transcribe <file>')
    .description('Transcribe an existing audio file')
    .action(async (file) => {
      await handleTranscribe(file, program.opts());
    });

  // list
  program
    .command('list')
    .description('List recent meetings')
    .option('-n, --count <number>', 'Number of meetings to show', '10')
    .action(async (cmdOpts) => {
      await handleList({ ...program.opts(), ...cmdOpts });
    });

  // search
  program
    .command('search <query>')
    .description('Search across meeting transcripts')
    .action(async (query) => {
      await handleSearch(query, program.opts());
    });

  // actions
  program
    .command('actions')
    .description('List open action items from all meetings')
    .action(async () => {
      await handleActions(program.opts());
    });

  // templates
  program
    .command('templates')
    .description('List available meeting templates')
    .action(() => {
      console.log(chalk.bold.blue('\n📋 Meeting Templates\n'));
      for (const t of listTemplates()) {
        console.log(chalk.white(`  ${chalk.bold(t.key)}`) + chalk.dim(` — ${t.name}`));
      }
      console.log(chalk.dim('\n  Usage: meet-scribe record --template standup\n'));
    });

  program.parse();
}
