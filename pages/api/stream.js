import fs from 'fs';
import path from 'path';

const TMP_DIR = '/tmp/clip-cutter-videos';

export const config = {
  api: { responseLimit: false },
};

export default function handler(req, res) {
  const { file } = req.query;

  if (!file || file.includes('..') || file.includes('/')) {
    return res.status(400).json({ error: 'Invalid file name' });
  }

  const filePath = path.join(TMP_DIR, file);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4',
    });

    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
    });

    fs.createReadStream(filePath).pipe(res);
  }
}
