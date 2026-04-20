# Clip Cutter — Windows Setup
# Run this in PowerShell as Administrator

Write-Host ""
Write-Host "  Clip Cutter - Setup" -ForegroundColor Cyan
Write-Host "  ===================" -ForegroundColor Cyan
Write-Host ""

# ── Helper ─────────────────────────────────────────────────────────────────
function Install-IfMissing {
  param($Command, $WingetId, $Label)
  if (Get-Command $Command -ErrorAction SilentlyContinue) {
    Write-Host "  [OK] $Label already installed" -ForegroundColor Green
  } else {
    Write-Host "  --> Installing $Label..." -ForegroundColor Yellow
    winget install --id $WingetId -e --accept-source-agreements --accept-package-agreements
  }
}

# ── Check winget ───────────────────────────────────────────────────────────
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  Write-Host "  [!] winget not found. Please update Windows or install App Installer from the Microsoft Store." -ForegroundColor Red
  exit 1
}

# ── Install dependencies ───────────────────────────────────────────────────
Install-IfMissing "node"    "OpenJS.NodeJS"   "Node.js"
Install-IfMissing "ffmpeg"  "Gyan.FFmpeg"     "ffmpeg"
Install-IfMissing "yt-dlp"  "yt-dlp.yt-dlp"  "yt-dlp"
Install-IfMissing "aria2c"  "aria2.aria2"     "aria2"

# ── Refresh PATH so newly installed tools are found ────────────────────────
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# ── npm install ────────────────────────────────────────────────────────────
Write-Host "  --> Installing npm packages..." -ForegroundColor Yellow
npm install

Write-Host ""
Write-Host "  All done! Starting Clip Cutter..." -ForegroundColor Green
Write-Host ""
Write-Host "  Open http://localhost:3000 in your browser." -ForegroundColor Cyan
Write-Host "  Press Ctrl+C to stop." -ForegroundColor Cyan
Write-Host ""

npm run dev
