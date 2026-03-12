import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { checkFfmpeg } from './utils.js';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

/**
 * Transcribe audio buffer (from recording chunks)
 */
export async function transcribeBuffer(wavBuffer, config, chunkIndex) {
  const tmpDir = path.join(process.cwd(), '.tmp');
  fs.mkdirSync(tmpDir, { recursive: true });

  const tmpPath = path.join(tmpDir, `chunk_${chunkIndex}.wav`);
  fs.writeFileSync(tmpPath, wavBuffer);

  try {
    const text = await sendToWhisper(tmpPath, config);
    return text;
  } finally {
    try { fs.unlinkSync(tmpPath); } catch {}
  }
}

/**
 * Transcribe audio file (for transcribe command)
 */
export async function transcribeAudio(filePath, config) {
  const stat = fs.statSync(filePath);

  if (stat.size <= MAX_FILE_SIZE) {
    return await sendToWhisper(filePath, config);
  }

  return await transcribeLargeFile(filePath, config);
}

/**
 * Send multipart/form-data request to Whisper API
 */
async function sendToWhisper(filePath, config) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('model', config.sttModel);
  form.append('response_format', 'text');

  // If 'auto', let Whisper detect the language
  if (config.language && config.language !== 'auto') {
    form.append('language', config.language);
  }

  const url = `${config.baseUrl}/audio/transcriptions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      ...form.getHeaders(),
    },
    body: form,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Whisper API error (${response.status}): ${errorText}`);
  }

  const text = await response.text();
  return text.trim();
}

/**
 * Split files over 25MB with ffmpeg and transcribe in parts
 */
async function transcribeLargeFile(filePath, config) {
  if (!checkFfmpeg()) {
    throw new Error(
      chalk.red('File is over 25MB, ffmpeg is required to split it!\n') +
      chalk.yellow('Install:\n') +
      chalk.dim('  macOS:   ') + chalk.white('brew install ffmpeg\n') +
      chalk.dim('  Ubuntu:  ') + chalk.white('sudo apt install ffmpeg\n') +
      chalk.dim('  Windows: ') + chalk.white('choco install ffmpeg  or  winget install ffmpeg')
    );
  }

  const tmpDir = path.join(process.cwd(), '.tmp_split');
  fs.mkdirSync(tmpDir, { recursive: true });

  // Split into 10-minute chunks
  const pattern = path.join(tmpDir, 'part_%03d.wav');
  execSync(`ffmpeg -i "${filePath}" -f segment -segment_time 600 -ar 16000 -ac 1 "${pattern}"`, {
    stdio: 'pipe',
  });

  const parts = fs.readdirSync(tmpDir)
    .filter(f => f.startsWith('part_') && f.endsWith('.wav'))
    .sort();

  let fullTranscript = '';

  for (const part of parts) {
    const partPath = path.join(tmpDir, part);
    const text = await sendToWhisper(partPath, config);
    fullTranscript += text + '\n';
  }

  // Cleanup
  for (const part of parts) {
    try { fs.unlinkSync(path.join(tmpDir, part)); } catch {}
  }
  try { fs.rmdirSync(tmpDir); } catch {}

  return fullTranscript.trim();
}
