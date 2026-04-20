#!/bin/bash

set -e

echo ""
echo "  Clip Cutter — Setup"
echo "  ==================="
echo ""

# ── Homebrew ───────────────────────────────────────────────────────────────
if ! command -v brew &>/dev/null; then
  echo "  → Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
else
  echo "  ✓ Homebrew already installed"
fi

# ── System dependencies ────────────────────────────────────────────────────
install_if_missing() {
  local cmd=$1
  local pkg=${2:-$1}
  if ! command -v "$cmd" &>/dev/null; then
    echo "  → Installing $pkg..."
    brew install "$pkg"
  else
    echo "  ✓ $pkg already installed"
  fi
}

install_if_missing ffmpeg ffmpeg
install_if_missing yt-dlp yt-dlp
install_if_missing aria2c aria2

# ── Node.js ────────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "  → Installing Node.js..."
  brew install node
else
  echo "  ✓ Node.js already installed ($(node -v))"
fi

# ── npm packages ───────────────────────────────────────────────────────────
echo "  → Installing npm packages..."
npm install

echo ""
echo "  ✓ All done! Starting Clip Cutter..."
echo ""
echo "  Open http://localhost:3000 in your browser."
echo "  Press Ctrl+C to stop."
echo ""

npm run dev
