import { execSync } from 'child_process';
import chalk from 'chalk';

/**
 * Platform bazlı ses cihazı tespiti (loopback öncelikli)
 * Her platform için otomatik olarak en uygun ses kaynağını bulur.
 */
export function detectAudioDevice() {
  const detectors = {
    win32: detectWindowsDevice,
    darwin: detectMacDevice,
    linux: detectLinuxDevice,
  };

  const detector = detectors[process.platform];
  if (!detector) {
    console.error(chalk.red(`\n✖ Desteklenmeyen platform: ${process.platform}`));
    return null;
  }

  return detector();
}

// ────────────────────────────────────────
// Windows: DirectShow
// ────────────────────────────────────────

const WINDOWS_LOOPBACK_KEYWORDS = ['stereo mix', 'what u hear', 'loopback', 'wave out', 'karışık ses'];

function detectWindowsDevice() {
  const output = runFfmpegListDevices('ffmpeg -list_devices true -f dshow -i dummy 2>&1');
  const devices = parseDeviceList(output, 'DirectShow audio devices', 'DirectShow video devices', /"([^"]+)"/);

  const loopback = findByKeywords(devices, WINDOWS_LOOPBACK_KEYWORDS);

  if (loopback) {
    return { args: ['-f', 'dshow', '-i', `audio=${loopback}`], deviceName: loopback };
  }

  if (devices.length > 0) {
    console.log(chalk.yellow(`⚠ Loopback cihazı bulunamadı. Mikrofon kullanılıyor: "${devices[0]}"`));
    console.log(chalk.dim('  Sistem sesini de yakalamak için Ses ayarlarından "Stereo Mix"i etkinleştirin.\n'));
    return { args: ['-f', 'dshow', '-i', `audio=${devices[0]}`], deviceName: devices[0] };
  }

  console.log(chalk.yellow('⚠ Ses cihazı listelenemedi, varsayılan giriş deneniyor...'));
  return { args: ['-f', 'dshow', '-i', 'audio=virtual-audio-capturer'], deviceName: 'Varsayılan ses girişi' };
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
    console.log(chalk.yellow(`⚠ Loopback cihazı bulunamadı. Varsayılan mikrofon: "${devices[0].name}"`));
    console.log(chalk.dim('  Sistem sesini de yakalamak için BlackHole kurun: brew install blackhole-2ch\n'));
    return { args: ['-f', 'avfoundation', '-i', `:${devices[0].index}`], deviceName: devices[0].name };
  }

  return { args: ['-f', 'avfoundation', '-i', ':0'], deviceName: 'Varsayılan ses girişi' };
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
      console.log(chalk.yellow(`⚠ Monitor bulunamadı, varsayılan kaynak: ${source}`));
    }

    return { args: ['-f', 'pulse', '-i', source], deviceName: source };
  } catch {
    return { args: ['-f', 'alsa', '-i', 'default'], deviceName: 'ALSA varsayılan' };
  }
}

// ────────────────────────────────────────
// Ortak yardımcılar
// ────────────────────────────────────────

/**
 * ffmpeg -list_devices komutunu çalıştır (her zaman hata kodu döner)
 */
function runFfmpegListDevices(command) {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).toString();
  } catch (err) {
    return err.stderr?.toString() || err.stdout?.toString() || err.message || '';
  }
}

/**
 * ffmpeg cihaz listesi çıktısını parse et
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
 * Cihaz listesinden keyword'e göre eşleşen ilk cihazı bul
 */
function findByKeywords(devices, keywords) {
  for (const device of devices) {
    const lower = device.toLowerCase();
    if (keywords.some(kw => lower.includes(kw))) return device;
  }
  return null;
}
