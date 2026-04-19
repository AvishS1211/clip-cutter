import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

const TMP_DIR = '/tmp/clip-cutter-videos';

export const config = {
  api: {
    responseLimit: false,
    bodyParser: { sizeLimit: '1mb' },
  },
};

function toNetscape(cookies) {
  try {
    const parsed = JSON.parse(cookies);
    if (!Array.isArray(parsed)) return cookies;
    const lines = ['# Netscape HTTP Cookie File'];
    for (const c of parsed) {
      const domain = c.domain || '';
      const flag = domain.startsWith('.') ? 'TRUE' : 'FALSE';
      const path_ = c.path || '/';
      const secure = c.secure ? 'TRUE' : 'FALSE';
      const expiry = c.expirationDate ? Math.floor(c.expirationDate) : 0;
      lines.push(`${domain}\t${flag}\t${path_}\t${secure}\t${expiry}\t${c.name}\t${c.value}`);
    }
    return lines.join('\n');
  } catch {
    return cookies;
  }
}

function writeCookiesFile() {
  const cookies = process.env.YOUTUBE_COOKIES;
  if (!cookies) return null;
  const cookiePath = path.join(os.tmpdir(), 'yt-cookies.txt');
  fs.writeFileSync(cookiePath, toNetscape(cookies.trim()), 'utf8');
  return cookiePath;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

  const timestamp = Date.now();
  const fileName = `video-${timestamp}.mp4`;
  const filePath = path.join(TMP_DIR, fileName);

  const cookiePath = writeCookiesFile();
  const cookieFlag = cookiePath ? `--cookies "${cookiePath}"` : '';

  try {
    await execAsync(
      `yt-dlp -f "best[ext=mp4]/best" ${cookieFlag} --no-check-certificates -o "${filePath}" "${url}"`,
      { timeout: 300000 }
    );

    if (!fs.existsSync(filePath)) {
      return res.status(500).json({ error: 'Download failed — file not found after yt-dlp' });
    }

    const { stdout: probeOut } = await execAsync(
      `ffprobe -v quiet -print_format json -show_format "${filePath}"`
    );
    const probe = JSON.parse(probeOut);
    const duration = parseFloat(probe.format?.duration || 0);

    return res.status(200).json({
      success: true,
      path: `/api/stream?file=${fileName}`,
      duration,
      fileName,
    });
  } catch (err) {
    console.error('Download error:', err.message);
    return res.status(500).json({ error: err.message || 'Download failed' });
  }
}
