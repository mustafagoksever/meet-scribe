import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

const CONFIG_FILENAME = '.meetscriberc';

const DEFAULTS = {
  apiKey: null,
  baseUrl: 'https://api.openai.com/v1',
  sttModel: 'whisper-1',
  llmModel: 'gpt-4o-mini',
  language: 'auto',
  summary: true,
  output: './meet-scribe-output',
  chunk: 30,
  template: 'default',
  format: 'md',
  webhook: null,
  zulipUrl: null,
  zulipEmail: null,
  zulipApiKey: null,
  zulipStream: null,
  zulipTopic: null,
  noiseFilter: false,
};

/**
 * Config resolution priority:
 * 1. CLI flag
 * 2. Environment variable
 * 3. Config file (.meetscriberc)
 * 4. Default value
 */
export function resolveConfig(opts) {
  const fileConfig = loadConfigFile();

  const config = {
    apiKey:      opts.apiKey      || process.env.OPENAI_API_KEY    || fileConfig.apiKey      || DEFAULTS.apiKey,
    baseUrl:     (opts.baseUrl    || process.env.OPENAI_BASE_URL   || fileConfig.baseUrl     || DEFAULTS.baseUrl).replace(/\/+$/, ''),
    sttModel:    opts.sttModel    || process.env.STT_MODEL         || fileConfig.sttModel    || DEFAULTS.sttModel,
    llmModel:    opts.llmModel    || process.env.LLM_MODEL         || fileConfig.llmModel    || DEFAULTS.llmModel,
    language:    opts.language    || process.env.LANGUAGE           || fileConfig.language    || DEFAULTS.language,
    summary:     opts.summary !== false,
    output:      opts.output      || fileConfig.output              || DEFAULTS.output,
    chunk:       parseInt(opts.chunk, 10) || fileConfig.chunk       || DEFAULTS.chunk,
    template:    opts.template    || fileConfig.template            || DEFAULTS.template,
    format:      opts.format      || fileConfig.format              || DEFAULTS.format,
    webhook:     opts.webhook     || fileConfig.webhook             || DEFAULTS.webhook,
    zulipUrl:    opts.zulipUrl    || process.env.ZULIP_URL         || fileConfig.zulipUrl    || DEFAULTS.zulipUrl,
    zulipEmail:  opts.zulipEmail  || process.env.ZULIP_EMAIL       || fileConfig.zulipEmail  || DEFAULTS.zulipEmail,
    zulipApiKey: opts.zulipApiKey || process.env.ZULIP_API_KEY     || fileConfig.zulipApiKey || DEFAULTS.zulipApiKey,
    zulipStream: opts.zulipStream || process.env.ZULIP_STREAM      || fileConfig.zulipStream || DEFAULTS.zulipStream,
    zulipTopic:  opts.zulipTopic  || process.env.ZULIP_TOPIC       || fileConfig.zulipTopic  || DEFAULTS.zulipTopic,
    noiseFilter: opts.noiseFilter || fileConfig.noiseFilter         || DEFAULTS.noiseFilter,
  };

  if (!config.apiKey) {
    console.error(chalk.red('\n✖ API key not found!\n'));
    console.error(chalk.yellow('Use one of the following methods:'));
    console.error(chalk.dim('  1. CLI flag:     ') + chalk.white('--api-key sk-...'));
    console.error(chalk.dim('  2. Env var:      ') + chalk.white('set OPENAI_API_KEY=sk-...'));
    console.error(chalk.dim('  3. Config file:  ') + chalk.white('meet-scribe init'));
    console.error();
    process.exit(1);
  }

  return config;
}

/**
 * Load config file: check project directory first, then home directory
 */
function loadConfigFile() {
  const paths = [
    path.join(process.cwd(), CONFIG_FILENAME),
    path.join(os.homedir(), CONFIG_FILENAME),
  ];

  for (const configPath of paths) {
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(content);
      } catch (err) {
        console.error(chalk.yellow(`⚠ Could not read config file: ${configPath} — ${err.message}`));
      }
    }
  }

  return {};
}

/**
 * Create default config file
 */
export function createConfigFile(targetDir) {
  const configPath = path.join(targetDir || process.cwd(), CONFIG_FILENAME);

  if (fs.existsSync(configPath)) {
    return { path: configPath, created: false };
  }

  const template = {
    apiKey: '',
    baseUrl: DEFAULTS.baseUrl,
    sttModel: DEFAULTS.sttModel,
    llmModel: DEFAULTS.llmModel,
    language: DEFAULTS.language,
    output: DEFAULTS.output,
    template: DEFAULTS.template,
    format: DEFAULTS.format,
    zulipUrl: '',
    zulipEmail: '',
    zulipApiKey: '',
    zulipStream: '',
    zulipTopic: 'Meeting Notes',
  };

  fs.writeFileSync(configPath, JSON.stringify(template, null, 2), 'utf-8');
  return { path: configPath, created: true };
}
