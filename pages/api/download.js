import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

const TMP_DIR = '/tmp/clip-cutter-videos';

export const config = {
  api: {
    responseLimit: false,
    bodyParser: { sizeLimit: '1mb' },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

  const timestamp = Date.now();
  const fileName = `video-${timestamp}.mp4`;
  const filePath = path.join(TMP_DIR, fileName);

  try {
    await execAsync(
      `yt-dlp -f "best[ext=mp4]/best" --extractor-args "youtube:player_client=android,web" --no-check-certificates -o "${filePath}" "${url}"`,
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
