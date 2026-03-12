# MeetScribe 🎙

Toplantı sesini kayıt eden, Whisper API ile transkript eden, LLM ile özetleyen ve Markdown dosyası üreten CLI aracı.

## ⚡ Özellikler

- **Gerçek zamanlı kayıt** — Mikrofon + sistem sesini yakalar, canlı transkript
- **Otomatik ses tespiti** — Platform bazlı loopback cihazını otomatik bulur
- **Pause/Resume** — Space tuşu ile kayıt duraklatma
- **Whisper STT** — OpenAI-compatible Whisper API ile konuşmayı metne çevirir
- **Otomatik dil tespiti** — Whisper dili kendisi tespit eder (veya elle belirt)
- **5 toplantı şablonu** — Default, standup, retro, karar, 1:1 görüşme
- **LLM analiz** — Özet, aksiyonlar, kararlar, ton analizi
- **Markdown + HTML çıktı** — Profesyonel toplantı notu formatında
- **Zulip / Webhook** — Toplantı sonrası otomatik bildirim
- **Toplantı geçmişi** — Arama, listeleme, aksiyon takibi
- **Gürültü filtreleme** — ffmpeg ile noise gate

## 📋 Gereksinimler

- **Node.js** 20+
- **ffmpeg** (ses kaydı ve büyük dosya parçalama için)

### ffmpeg Kurulumu

| Platform | Komut |
|----------|-------|
| macOS | `brew install ffmpeg` |
| Ubuntu | `sudo apt install ffmpeg` |
| Windows | `choco install ffmpeg` veya `winget install ffmpeg` |

### 🔊 Tüm Sesleri Yakalamak İçin (Toplantı Katılımcıları Dahil)

MeetScribe sadece mikrofon sesi değil, **bilgisayardan çıkan tüm sesleri** (toplantıdaki diğer kişiler dahil) yakalayabilir. Bunun için aşağıdaki ayarlardan birini yapmanız gerekir.

MeetScribe otomatik olarak loopback cihazını arar. Bulamazsa sadece mikrofonu kullanır ve sizi uyarır.

---

#### 🎛 Stereo Mix Nedir?

**Stereo Mix**, Windows'ta yerleşik olarak gelen sanal bir ses cihazıdır. Bilgisayarınızın hoparlör/kulaklığından çıkan tüm sesleri bir "kayıt cihazı" olarak sunar. Böylece:

- 🎧 Toplantıdaki diğer katılımcıların sesleri yakalanır
- 🎤 Bazı sürücülerde mikrofon sesi de otomatik dahil olur
- ⚙️ Ekstra yazılım kurmaya gerek yoktur

> ⚠️ Stereo Mix tüm bilgisayarlarda varsayılan olarak aktif değildir. Bazı ses kartı sürücüleri (özellikle Realtek) bu özelliği gizler.

---

#### Windows Kurulumu (Yöntem 1: Stereo Mix)

1. Right-click the **🔊 speaker icon** in the taskbar → **Sound settings**
2. Scroll down → click **More sound settings**
3. Go to the **Recording** tab
4. Right-click on empty space → check ✅ **"Show Disabled Devices"**
5. **Stereo Mix** should appear → Right-click → **Enable**
6. Right-click **Stereo Mix** again → **Set as Default Device**
7. Click **OK**

MeetScribe çalıştığında `✓ Ses kaynağı: Stereo Mix` mesajını göreceksiniz.

---

#### Windows Kurulumu (Yöntem 2: VB-Cable — Stereo Mix Yoksa)

1. https://vb-audio.com/Cable/ → **Download** → Kur → PC'yi **restart** et
2. Open **Sound settings** → **More sound settings**
3. **Playback** tab → **CABLE Input** → Right-click → **Set as Default Device**
4. **Recording** tab → **CABLE Output** → Right-click → **Set as Default Device**

**Kendi sesinizi de dahil etmek için (opsiyonel):**
1. **Recording** tab → **Microphone** → Right-click → **Properties**
2. **Listen** tab → ✅ check **"Listen to this device"**
3. **"Playback through this device"** → select **CABLE Input**
4. Click **OK**

---

#### macOS Kurulumu

1. [BlackHole](https://github.com/ExistentialAudio/BlackHole) kur: `brew install blackhole-2ch`
2. System Settings → Sound → Create Multi-Output Device

#### Linux

PulseAudio monitor kaynağı otomatik tespit edilir. Ek kurulum gerektirmez.

---

## 🚀 Kurulum

### 1. Projeyi klonla veya indir

```bash
git clone <repo-url>
cd asel-meet
```

### 2. Bağımlılıkları kur

```bash
npm install
```

Bu komut `package.json`'daki tüm bağımlılıkları (`commander`, `chalk`, `ora`, `node-fetch`, `form-data`) indirip `node_modules/` klasörüne kurar.

### 3. Global komut olarak kaydet (opsiyonel)

```bash
npm link
```

Bu komut `meet-scribe`'ı sistem genelinde bir komut olarak kaydeder.

### 4. Config dosyası oluştur

```bash
meet-scribe init
# veya
node bin/meet-scribe.js init
```

`.meetscriberc` dosyası oluşturulur. API key ve diğer ayarlarınızı buraya girin.

---

## 🏃 Hızlı Başlatma

```bash
# Windows
run.bat record

# macOS / Linux
./run.sh record
```

Bu script'ler `node_modules` yoksa otomatik `npm install` çalıştırır.

---

## 📖 Kullanım

### Toplantı Kaydı (Gerçek Zamanlı)

```bash
# Temel kullanım — Ctrl+C ile durdur, Space ile durakla
meet-scribe record --api-key sk-...

# Şablonla
meet-scribe record --template standup
meet-scribe record --template retro
meet-scribe record --template decision
meet-scribe record --template oneone

# Gürültü filtreleme ile
meet-scribe record --noise-filter

# HTML çıktı ile
meet-scribe record --format html
```

### Mevcut Dosya Transkripsiyonu

```bash
meet-scribe transcribe toplanti.mp3 --api-key sk-...
```

### Toplantı Geçmişi

```bash
meet-scribe list                  # Son 10 toplantıyı listele
meet-scribe list -n 20            # Son 20 toplantı
meet-scribe search "bütçe"        # Toplantılarda arama
meet-scribe actions               # Açık aksiyon maddelerini göster
```

### Şablonlar

```bash
meet-scribe templates             # Kullanılabilir şablonları listele
```

### Zulip Entegrasyonu

```bash
meet-scribe record \
  --zulip-url https://chat.example.com \
  --zulip-email bot@example.com \
  --zulip-api-key abc123 \
  --zulip-stream "toplanti-notlari" \
  --zulip-topic "Sprint Planning"
```

Veya `.meetscriberc` dosyasına ekleyin:

```json
{
  "zulipUrl": "https://chat.example.com",
  "zulipEmail": "bot@example.com",
  "zulipApiKey": "abc123",
  "zulipStream": "toplanti-notlari",
  "zulipTopic": "Toplantı Notları"
}
```

### Webhook Entegrasyonu

```bash
meet-scribe record --webhook https://hooks.example.com/meeting
```

### Ortam Değişkenleri

```bash
export OPENAI_API_KEY=sk-...             # macOS/Linux
set OPENAI_API_KEY=sk-...                # Windows cmd
$env:OPENAI_API_KEY="sk-..."             # PowerShell

# Opsiyonel
export OPENAI_BASE_URL=https://api.example.com/v1
export ZULIP_URL=https://chat.example.com
export ZULIP_EMAIL=bot@example.com
export ZULIP_API_KEY=abc123
```

## ⚙️ CLI Seçenekleri

| Seçenek | Açıklama | Varsayılan |
|---------|----------|------------|
| `--api-key` | API key | `OPENAI_API_KEY` env |
| `--base-url` | API base URL | `https://api.openai.com/v1` |
| `--stt-model` | Whisper model | `whisper-1` |
| `--llm-model` | LLM model | `gpt-4o-mini` |
| `--language` | Dil kodu (`auto` = otomatik) | `auto` |
| `--no-summary` | LLM özetini atla | — |
| `--output` | Çıktı dizini | `./meet-scribe-output` |
| `--chunk` | Chunk süresi (saniye) | `30` |
| `--template` | Toplantı şablonu | `default` |
| `--format` | Çıktı formatı: `md`, `html` | `md` |
| `--webhook` | Webhook URL | — |
| `--zulip-url` | Zulip sunucu URL | — |
| `--zulip-email` | Zulip bot email | — |
| `--zulip-api-key` | Zulip API key | — |
| `--zulip-stream` | Zulip stream adı | — |
| `--zulip-topic` | Zulip topic adı | — |
| `--noise-filter` | Gürültü filtreleme | kapalı |

## 📋 Komutlar

| Komut | Açıklama |
|-------|----------|
| `init` | Config dosyası (`.meetscriberc`) oluştur |
| `record` | Ses kaydet + gerçek zamanlı transkript (Space=durakla) |
| `transcribe <dosya>` | Mevcut ses dosyasını transkript et |
| `list` | Son toplantıları listele |
| `search <sorgu>` | Toplantılarda arama |
| `actions` | Tamamlanmamış aksiyon maddelerini listele |
| `templates` | Kullanılabilir şablonları göster |

## 🗂 Toplantı Şablonları

| Şablon | Açıklama | Çıktı |
|--------|----------|-------|
| `default` | Genel toplantı | Özet, konular, aksiyonlar, kararlar |
| `standup` | Daily standup | Katılımcı bazlı dün/bugün/engel |
| `retro` | Retrospektif | İyi/kötü giden + iyileştirmeler |
| `decision` | Karar toplantısı | Kararlar + gerekçeler + sorumlular |
| `oneone` | 1:1 görüşme | Geri bildirim + gelişim alanları |

## 📁 Çıktı Formatı

Çıktı dosyaları `./meet-scribe-output/` dizinine `toplanti_YYYY-MM-DDTHH-MM-SS.md` formatında kaydedilir.

Her dosya şu bölümleri içerir:
- 📝 **Transkript** — Zaman damgalı konuşma metni
- 📌 **Özet** — 2-3 cümlelik toplantı özeti
- 🗂 **Ana Konular** — Tartışılan konular
- ✅ **Aksiyon Maddeleri** — Yapılacak işler ve sorumlular
- ⚖️ **Alınan Kararlar** — Toplantıda alınan kararlar

## 📄 Lisans

MIT
