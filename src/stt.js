import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { checkFfmpeg } from './utils.js';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

/**
 * Ses dosyasını Whisper API'ye gönderip transkript al
 */
export async function transcribeAudio(filePath, config) {
  const stat = fs.statSync(filePath);

  // 25MB üzeri dosyaları ffmpeg ile parçala
  if (stat.size > MAX_FILE_SIZE) {
    return await transcribeLargeFile(filePath, config);
  }

  return await sendToWhisper(filePath, config);
}

/**
 * Buffer'ı geçici dosyaya yazıp Whisper'a gönder
 */
export async function transcribeBuffer(buffer, config, chunkIndex = 0) {
  const tmpDir = path.join(config.output, '.tmp');
  fs.mkdirSync(tmpDir, { recursive: true });

  const tmpFile = path.join(tmpDir, `chunk_${chunkIndex}_${Date.now()}.wav`);
  fs.writeFileSync(tmpFile, buffer);

  try {
    const result = await sendToWhisper(tmpFile, config);
    return result;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

/**
 * Whisper API'ye multipart/form-data isteği gönder
 */
async function sendToWhisper(filePath, config) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('model', config.sttModel);
  form.append('response_format', 'text');

  // 'auto' ise Whisper kendi tespit etsin
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
    throw new Error(`Whisper API hatası (${response.status}): ${errorText}`);
  }

  const text = await response.text();
  return text.trim();
}

/**
 * 25MB üzeri dosyaları ffmpeg ile parçalayıp transkript et
 */
async function transcribeLargeFile(filePath, config) {
  if (!checkFfmpeg()) {
    throw new Error(
      chalk.red('Dosya 25MB üzerinde, parçalamak için ffmpeg gerekli!\n') +
      chalk.yellow('Kurulum:\n') +
      chalk.dim('  macOS:   ') + chalk.white('brew install ffmpeg\n') +
      chalk.dim('  Ubuntu:  ') + chalk.white('sudo apt install ffmpeg\n') +
      chalk.dim('  Windows: ') + chalk.white('choco install ffmpeg  veya  winget install ffmpeg')
    );
  }

  const tmpDir = path.join(config.output, '.tmp_split');
  fs.mkdirSync(tmpDir, { recursive: true });

  const chunkPattern = path.join(tmpDir, 'part_%03d.mp3');

  // 10 dakikalık parçalara böl
  execSync(
    `ffmpeg -y -i "${filePath}" -f segment -segment_time 600 -c copy "${chunkPattern}"`,
    { stdio: 'pipe' }
  );

  const chunks = fs.readdirSync(tmpDir)
    .filter(f => f.startsWith('part_'))
    .sort();

  let fullTranscript = '';

  for (const chunk of chunks) {
    const chunkPath = path.join(tmpDir, chunk);
    const text = await sendToWhisper(chunkPath, config);
    fullTranscript += text + ' ';
  }

  // Temizlik
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch { /* ignore */ }

  return fullTranscript.trim();
}
