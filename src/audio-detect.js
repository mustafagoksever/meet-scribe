import { execSync } from 'child_process';
import chalk from 'chalk';

/**
 * Platform-specific audio device detection (loopback preferred)
 * Automatically finds the best audio source for each platform.
 */
export function detectAudioDevice() {
  const detectors = {
    win32: detectWindowsDevice,
    darwin: detectMacDevice,
    linux: detectLinuxDevice,
  };

  const detector = detectors[process.platform];
  if (!detector) {
    console.error(chalk.red(`\n✖ Unsupported platform: ${process.platform}`));
    return null;
  }

  return detector();
}

// ────────────────────────────────────────
// Windows: DirectShow
// ────────────────────────────────────────

const WINDOWS_LOOPBACK_KEYWORDS = ['stereo mix', 'what u hear', 'loopback', 'wave out'];

function detectWindowsDevice() {
  const output = runFfmpegListDevices('ffmpeg -list_devices true -f dshow -i dummy 2>&1');
  const devices = parseDeviceList(output, 'DirectShow audio devices', 'DirectShow video devices', /"([^"]+)"/);

  const loopback = findByKeywords(devices, WINDOWS_LOOPBACK_KEYWORDS);

  if (loopback) {
    return { args: ['-f', 'dshow', '-i', `audio=${loopback}`], deviceName: loopback };
  }

  if (devices.length > 0) {
    console.log(chalk.yellow(`⚠ Loopback device not found. Using microphone: "${devices[0]}"`));
    console.log(chalk.dim('  To capture system audio, enable "Stereo Mix" in Sound settings.\n'));
    return { args: ['-f', 'dshow', '-i', `audio=${devices[0]}`], deviceName: devices[0] };
  }

  console.log(chalk.yellow('⚠ Could not list audio devices, trying default input...'));
  return { args: ['-f', 'dshow', '-i', 'audio=virtual-audio-capturer'], deviceName: 'Default audio input' };
}

// ────────────────────────────────────────
// macOS: AVFoundation
// ────────────────────────────────────────

const MAC_LOOPBACK_KEYWORDS = ['blackhole', 'loopback', 'soundflower', 'multi-output'];

function detectMacDevice() {
  const output = runFfmpegListDevices('ffmpeg -f avfoundation -list_devices true -i "" 2>&1');
  const devices = parseMacDeviceList(output);

  const loopback = devices.find(d => MAC_LOOPBACK_KEYWORDS.some(kw => d.name.toLowerCase().includes(kw)));

  if (loopback) {
    return { args: ['-f', 'avfoundation', '-i', `:${loopback.index}`], deviceName: loopback.name };
  }

  if (devices.length > 0) {
    console.log(chalk.yellow(`⚠ Loopback device not found. Using default mic: "${devices[0].name}"`));
    console.log(chalk.dim('  To capture system audio, install BlackHole: brew install blackhole-2ch\n'));
    return { args: ['-f', 'avfoundation', '-i', `:${devices[0].index}`], deviceName: devices[0].name };
  }

  return { args: ['-f', 'avfoundation', '-i', ':0'], deviceName: 'Default audio input' };
}

function parseMacDeviceList(output) {
  const devices = [];
  let inAudio = false;

  for (const line of output.split('\n')) {
    if (line.includes('AVFoundation audio devices')) { inAudio = true; continue; }
    if (inAudio) {
      const match = line.match(/\[(\d+)\]\s+(.+)/);
      if (match) devices.push({ index: match[1], name: match[2].trim() });
    }
  }
  return devices;
}

// ────────────────────────────────────────
// Linux: PulseAudio / ALSA
// ────────────────────────────────────────

function detectLinuxDevice() {
  try {
    const result = execSync('pactl list short sources 2>/dev/null', { encoding: 'utf-8' });
    const lines = result.trim().split('\n');

    let monitorSource = null;
    let defaultSource = null;

    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length >= 2) {
        const name = parts[1];
        if (name.includes('.monitor')) monitorSource = name;
        else if (!defaultSource) defaultSource = name;
      }
    }

    const source = monitorSource || defaultSource || 'default';

    if (monitorSource) {
      console.log(chalk.green(`✓ PulseAudio monitor: ${monitorSource}`));
    } else {
      console.log(chalk.yellow(`⚠ Monitor not found, using default source: ${source}`));
    }

    return { args: ['-f', 'pulse', '-i', source], deviceName: source };
  } catch {
    return { args: ['-f', 'alsa', '-i', 'default'], deviceName: 'ALSA default' };
  }
}

// ────────────────────────────────────────
// Shared helpers
// ────────────────────────────────────────

/**
 * Run ffmpeg -list_devices (always returns error code)
 */
function runFfmpegListDevices(command) {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).toString();
  } catch (err) {
    return err.stderr?.toString() || err.stdout?.toString() || err.message || '';
  }
}

/**
 * Parse ffmpeg device list output
 */
function parseDeviceList(output, startMarker, endMarker, pattern) {
  const devices = [];
  let inSection = false;

  for (const line of output.split('\n')) {
    if (line.includes(startMarker)) { inSection = true; continue; }
    if (endMarker && line.includes(endMarker) && inSection) break;
    if (inSection) {
      const match = line.match(pattern);
      if (match) devices.push(match[1]);
    }
  }
  return devices;
}

/**
 * Find first device matching any keyword
 */
function findByKeywords(devices, keywords) {
  for (const device of devices) {
    const lower = device.toLowerCase();
    if (keywords.some(kw => lower.includes(kw))) return device;
  }
  return null;
}
