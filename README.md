# Clip Cutter

Extract clips from any video URL — YouTube, X, news, and more.

## Quick Start (Mac)

```bash
git clone https://github.com/AvishS1211/clip-cutter.git
cd clip-cutter
bash setup.sh
```

That's it. The script installs everything and opens the app at `http://localhost:3000`.

## What it installs

- `ffmpeg` — video processing
- `yt-dlp` — video downloading
- `aria2` — fast parallel downloads
- `node` — if not already installed

Nothing is installed globally that you don't already have. All checks run before installing.

## Manual setup (if you prefer)

```bash
brew install ffmpeg yt-dlp aria2
npm install
npm run dev
```

## Usage

1. Paste a video URL and hit Download
2. Use the timeline to mark In and Out points
3. Click Export Clip — MP4 downloads instantly
