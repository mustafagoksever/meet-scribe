@echo off
REM MeetScribe - Hızlı Başlatma (Windows)
REM Kullanım: run.bat record  veya  run.bat transcribe dosya.mp3

cd /d "%~dp0"

IF NOT EXIST node_modules (
    echo [*] Bagimliliklar kuruluyor...
    npm install
)

node bin/meet-scribe.js %*
