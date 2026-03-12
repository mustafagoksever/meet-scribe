# MeetScribe 🎙

CLI tool that records meetings, transcribes with Whisper API, summarizes with LLM, and generates Markdown.

## ⚡ Features

- **Real-time recording** — Captures mic + system audio, live transcription
- **Auto device detection** — Automatically finds loopback audio per platform
- **Pause/Resume** — Press Space to pause recording
- **Whisper STT** — Transcribes speech using OpenAI-compatible Whisper API
- **Auto language detection** — Whisper detects language automatically (or set manually)
- **5 meeting templates** — General, standup, retro, decision, 1:1
- **LLM analysis** — Summary, action items, decisions, tone analysis
- **Markdown + HTML output** — Professional meeting notes format
- **Webhook / Zulip** — Auto-notify after meeting ends
- **Meeting history** — Search, list, and track action items
- **Noise filtering** — ffmpeg noise gate for cleaner audio
- **Unlimited speakers** — 10 color-coded speaker labels, cycling
- **Web Dashboard** — Real-time frontend UI during recording (`--web`)

## 📋 Requirements

- **Node.js** 20+
- **ffmpeg** (for audio recording and large file splitting)

### Installing ffmpeg

| Platform | Command |
|----------|---------|
| macOS | `brew install ffmpeg` |
| Ubuntu | `sudo apt install ffmpeg` |
| Windows | `choco install ffmpeg` or `winget install ffmpeg` |

### 🔊 Capturing All Audio (Including Meeting Participants)

MeetScribe can capture **all audio from your computer** (including other meeting participants), not just your microphone. Set up one of the following:

MeetScribe automatically searches for a loopback device. If none is found, it falls back to microphone-only and warns you.

---

#### 🎛 What is Stereo Mix?

**Stereo Mix** is a built-in virtual audio device on Windows. It presents all audio going to your speakers/headphones as a "recording device". This means:

- 🎧 Other participants' voices are captured
- 🎤 Some drivers also include microphone audio
- ⚙️ No extra software needed

> ⚠️ Stereo Mix is not enabled by default on all computers. Some audio drivers (especially Realtek) hide this feature.

---

#### Windows Setup (Method 1: Stereo Mix)

1. Right-click the **🔊 speaker icon** in the taskbar → **Sound settings**
2. Scroll down → click **More sound settings**
3. Go to the **Recording** tab
4. Right-click on empty space → check ✅ **"Show Disabled Devices"**
5. **Stereo Mix** should appear → Right-click → **Enable**
6. Right-click **Stereo Mix** again → **Set as Default Device**
7. Click **OK**

You should see `✓ Audio source: Stereo Mix` when MeetScribe starts.

---

#### Windows Setup (Method 2: VB-Cable — If No Stereo Mix)

1. https://vb-audio.com/Cable/ → **Download** → Install → **Restart** PC
2. Open **Sound settings** → **More sound settings**
3. **Playback** tab → **CABLE Input** → Right-click → **Set as Default Device**
4. **Recording** tab → **CABLE Output** → Right-click → **Set as Default Device**

**To include your own voice (optional):**
1. **Recording** tab → **Microphone** → Right-click → **Properties**
2. **Listen** tab → ✅ check **"Listen to this device"**
3. **"Playback through this device"** → select **CABLE Input**
4. Click **OK**

---

#### macOS Setup

1. Install [BlackHole](https://github.com/ExistentialAudio/BlackHole): `brew install blackhole-2ch`
2. System Settings → Sound → Create Multi-Output Device

#### Linux

PulseAudio monitor source is auto-detected. No extra setup needed.

---

## 🚀 Installation

```bash
git clone https://github.com/mustafagoksever/meet-scribe.git
cd meet-scribe
npm install
```

### Global install (optional)

```bash
npm link
```

### Create config file

```bash
meet-scribe init
```

Edit `.meetscriberc` to set your API key and other preferences.

---

## 🏃 Quick Start

```bash
# Windows
run.bat record

# macOS / Linux
./run.sh record
```

These scripts auto-install dependencies if `node_modules` is missing.

---

## 📖 Usage

### Record Meeting (Real-time)

```bash
# Basic — Ctrl+C to stop, Space to pause
meet-scribe record --api-key sk-...

# With template
meet-scribe record --template standup
meet-scribe record --template retro
meet-scribe record --template decision
meet-scribe record --template oneone

# With noise filtering
meet-scribe record --noise-filter

# HTML output
meet-scribe record --format html
```

### Transcribe Existing File

```bash
meet-scribe transcribe recording.mp3 --api-key sk-...
```

### Meeting History

```bash
meet-scribe list                  # Last 10 meetings
meet-scribe list -n 20            # Last 20 meetings
meet-scribe search "budget"       # Search across meetings
meet-scribe actions               # Show open action items
```

### Templates

```bash
meet-scribe templates             # List available templates
```

### Zulip Integration

```bash
meet-scribe record \
  --zulip-url https://chat.example.com \
  --zulip-email bot@example.com \
  --zulip-api-key abc123 \
  --zulip-stream "meeting-notes" \
  --zulip-topic "Sprint Planning"
```

Or add to `.meetscriberc`:

```json
{
  "zulipUrl": "https://chat.example.com",
  "zulipEmail": "bot@example.com",
  "zulipApiKey": "abc123",
  "zulipStream": "meeting-notes",
  "zulipTopic": "Meeting Notes"
}
```

### Webhook Integration

```bash
meet-scribe record --webhook https://hooks.example.com/meeting
```

### Environment Variables

```bash
export OPENAI_API_KEY=sk-...             # macOS/Linux
set OPENAI_API_KEY=sk-...                # Windows cmd
$env:OPENAI_API_KEY="sk-..."             # PowerShell
```

## ⚙️ CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--api-key` | API key | `OPENAI_API_KEY` env |
| `--base-url` | API base URL | `https://api.openai.com/v1` |
| `--stt-model` | Whisper model | `whisper-1` |
| `--llm-model` | LLM model | `gpt-4o-mini` |
| `--language` | Language code (`auto` = auto-detect) | `auto` |
| `--no-summary` | Skip LLM summary | — |
| `--output` | Output directory | `./meet-scribe-output` |
| `--chunk` | Chunk duration (seconds) | `30` |
| `--template` | Meeting template | `default` |
| `--format` | Output format: `md`, `html` | `md` |
| `--webhook` | Webhook URL | — |
| `--zulip-url` | Zulip server URL | — |
| `--zulip-email` | Zulip bot email | — |
| `--zulip-api-key` | Zulip API key | — |
| `--zulip-stream` | Zulip stream name | — |
| `--zulip-topic` | Zulip topic name | — |
| `--noise-filter` | Enable noise filtering | off |
| `--web` | Start real-time web dashboard | off |
| `--web-port` | Web dashboard port | `3000` |

## 📋 Commands

| Command | Description |
|---------|-------------|
| `init` | Create config file (`.meetscriberc`) |
| `record` | Record + real-time transcription (Space=pause) |
| `transcribe <file>` | Transcribe existing audio file |
| `list` | List recent meetings |
| `search <query>` | Search across meetings |
| `actions` | List open action items |
| `templates` | Show available templates |

## 🗂 Meeting Templates

| Template | Description | Output |
|----------|-------------|--------|
| `default` | General meeting | Summary, topics, actions, decisions |
| `standup` | Daily standup | Per-participant yesterday/today/blockers |
| `retro` | Retrospective | Went well / went wrong + improvements |
| `decision` | Decision meeting | Decisions + rationale + owners |
| `oneone` | 1:1 meeting | Feedback + growth areas |

## 📄 License

MIT
