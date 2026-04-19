import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

const TMP_DIR = '/tmp/clip-cutter-videos';
const EXPORT_DIR = '/tmp/clip-cutter-videos/exports';

export const config = {
  api: { responseLimit: false },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { path: streamPath, startTime, endTime, fileName } = req.body;

  if (!streamPath || startTime === undefined || endTime === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (startTime >= endTime) {
    return res.status(400).json({ error: 'Mark In must be before Mark Out' });
  }

  const fileParam = new URL(streamPath, 'http://localhost').searchParams.get('file');
  if (!fileParam || fileParam.includes('..')) {
    return res.status(400).json({ error: 'Invalid file reference' });
  }

  const inputPath = path.join(TMP_DIR, fileParam);
  if (!fs.existsSync(inputPath)) {
    return res.status(404).json({ error: 'Source file not found' });
  }

  if (!fs.existsSync(EXPORT_DIR)) fs.mkdirSync(EXPORT_DIR, { recursive: true });

  const outputName = `clip-${Date.now()}.mp4`;
  const outputPath = path.join(EXPORT_DIR, outputName);

  const duration = endTime - startTime;

  try {
    await execAsync(
      `ffmpeg -ss ${startTime} -i "${inputPath}" -t ${duration} -c:v libx264 -preset ultrafast -c:a copy "${outputPath}"`,
      { timeout: 300000 }
    );

    if (!fs.existsSync(outputPath)) {
      return res.status(500).json({ error: 'Export failed — output file missing' });
    }

    const stat = fs.statSync(outputPath);

    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Content-Disposition': `attachment; filename="${outputName}"`,
      'Content-Length': stat.size,
    });

    const stream = fs.createReadStream(outputPath);
    stream.pipe(res);
    stream.on('close', () => {
      fs.unlink(outputPath, () => {});
    });
  } catch (err) {
    console.error('Export error:', err.message);
    return res.status(500).json({ error: err.message || 'Export failed' });
  }
}
