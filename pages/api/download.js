import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);
const TMP_DIR = '/tmp/clip-cutter-videos';

export const config = {
  api: { responseLimit: false, bodyParser: { sizeLimit: '1mb' } },
};

function toNetscape(cookies) {
  try {
    const parsed = JSON.parse(cookies);
    if (!Array.isArray(parsed)) return cookies;
    const lines = ['# Netscape HTTP Cookie File'];
    for (const c of parsed) {
      const domain = c.domain || '';
      const flag = domain.startsWith('.') ? 'TRUE' : 'FALSE';
      const secure = c.secure ? 'TRUE' : 'FALSE';
      const expiry = c.expirationDate ? Math.floor(c.expirationDate) : 0;
      lines.push(`${domain}\t${flag}\t${c.path || '/'}\t${secure}\t${expiry}\t${c.name}\t${c.value}`);
    }
    return lines.join('\n');
  } catch {
    return cookies;
  }
}

function writeCookiesFile() {
  const cookies = process.env.YOUTUBE_COOKIES;
  if (!cookies) return null;
  const trimmed = cookies.trim();
  const converted = toNetscape(trimmed);
  const cookiePath = path.join(os.tmpdir(), 'yt-cookies.txt');
  fs.writeFileSync(cookiePath, converted, 'utf8');
  return cookiePath;
}

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

  const fileName = `video-${Date.now()}.mp4`;
  const filePath = path.join(TMP_DIR, fileName);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const cookiePath = writeCookiesFile();
  const args = [
    '-f', 'best[ext=mp4]/best',
    '--newline',
    '--no-check-certificates',
    '-o', filePath,
  ];
  if (cookiePath) args.push('--cookies', cookiePath);
  args.push(url);

  const proc = spawn('yt-dlp', args);
  let stderr = '';

  proc.stdout.on('data', (chunk) => {
    const line = chunk.toString();
    const match = line.match(/\[download\]\s+(\d+\.?\d*)%/);
    if (match) send({ progress: parseFloat(match[1]) });
  });

  proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

  proc.on('close', async (code) => {
    if (code !== 0) {
      send({ error: stderr.split('\n').filter(l => l.includes('ERROR')).pop() || 'Download failed' });
      res.end();
      return;
    }

    send({ progress: 100, stage: 'processing' });

    try {
      const { stdout } = await execAsync(
        `ffprobe -v quiet -print_format json -show_format "${filePath}"`
      );
      const probe = JSON.parse(stdout);
      const duration = parseFloat(probe.format?.duration || 0);
      send({ success: true, path: `/api/stream?file=${fileName}`, duration, fileName });
    } catch {
      send({ error: 'Failed to read video metadata' });
    }

    res.end();
  });

  req.on('close', () => {
    if (proc && !proc.killed) proc.kill();
  });
}
