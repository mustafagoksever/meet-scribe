#!/bin/bash
# MeetScribe - Hızlı Başlatma (macOS/Linux)
# Kullanım: ./run.sh record  veya  ./run.sh transcribe dosya.mp3

cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
    echo "[*] Bağımlılıklar kuruluyor..."
    npm install
fi

node bin/meet-scribe.js "$@"
