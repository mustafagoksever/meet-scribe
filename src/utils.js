import chalk from 'chalk';
import { execSync } from 'child_process';

/**
 * Check if ffmpeg is installed
 */
export function checkFfmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Show ffmpeg not found error and exit
 */
export function exitIfNoFfmpeg() {
  if (!checkFfmpeg()) {
    console.error(chalk.red('\n✖ ffmpeg not found!\n'));
    console.error(chalk.yellow('Install it:\n'));
    console.error(chalk.dim('  macOS:   ') + chalk.white('brew install ffmpeg'));
    console.error(chalk.dim('  Ubuntu:  ') + chalk.white('sudo apt install ffmpeg'));
    console.error(chalk.dim('  Windows: ') + chalk.white('choco install ffmpeg  or  winget install ffmpeg'));
    console.error();
    process.exit(1);
  }
}

/**
 * Add WAV header (44 bytes) to raw PCM buffer
 */
export function addWavHeader(pcmBuffer, sampleRate = 16000, channels = 1, bitsPerSample = 16) {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;
  const fileSize = 44 + dataSize;

  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(fileSize - 8, 4);
  header.write('WAVE', 8);

  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

/**
 * Calculate RMS (volume level) of a 16-bit PCM buffer
 */
export function calculateRMS(buffer) {
  if (buffer.length < 2) return 0;

  let sum = 0;
  const sampleCount = Math.floor(buffer.length / 2);

  for (let i = 0; i < buffer.length - 1; i += 2) {
    const sample = buffer.readInt16LE(i) / 32768.0;
    sum += sample * sample;
  }

  return Math.sqrt(sum / sampleCount);
}

/**
 * Seconds → [MM:SS] format
 */
export function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * Print separator line
 */
export function printSeparator(length = 50) {
  console.log(chalk.dim('─'.repeat(length)));
}

/**
 * Print title banner
 */
export function printBanner(title) {
  console.log(chalk.bold.blue(`\n🎙  MeetScribe - ${title}`));
  printSeparator();
}
