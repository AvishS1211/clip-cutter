# Clip Cutter

Extract clips from any video URL — YouTube, X, X broadcasts, and more.

---

## Quick Start — Mac

```bash
git clone https://github.com/AvishS1211/clip-cutter.git
cd clip-cutter
bash setup.sh
```

---

## Quick Start — Windows

1. Open **PowerShell as Administrator** (right-click → Run as Administrator)
2. Run:

```powershell
git clone https://github.com/AvishS1211/clip-cutter.git
cd clip-cutter
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\setup-windows.ps1
```

> **Note:** `Set-ExecutionPolicy` is needed to allow the script to run. It only applies to the current session.

---

## What gets installed

| Package | Purpose |
|---|---|
| **Node.js** | Runs the app |
| **ffmpeg** | Trims and exports clips |
| **yt-dlp** | Downloads videos from URLs |
| **aria2** | Fast parallel downloads |

All checks run before installing — nothing gets overwritten if already installed.

---

## Starting the app after first setup

**Mac:**
```bash
cd clip-cutter
npm run dev
```

**Windows:**
```powershell
cd clip-cutter
npm run dev
```

Then open **http://localhost:3000** in your browser.

Press `Ctrl+C` to stop.

---

## Manual setup (if you prefer)

**Mac:**
```bash
brew install ffmpeg yt-dlp aria2
npm install
npm run dev
```

**Windows** (in PowerShell as Admin):
```powershell
winget install OpenJS.NodeJS Gyan.FFmpeg yt-dlp.yt-dlp aria2.aria2
npm install
npm run dev
```
