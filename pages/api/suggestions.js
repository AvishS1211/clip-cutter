import fs from 'fs';
import { analysisPath } from '../../lib/analyzeVideo';

export default function handler(req, res) {
  const { file } = req.query;

  if (!file || file.includes('/') || file.includes('..') || !file.endsWith('.mp4')) {
    return res.status(400).json({ error: 'Invalid file' });
  }

  const filePath = analysisPath(file);

  if (!fs.existsSync(filePath)) {
    return res.json({ status: 'pending' });
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    res.json(data);
  } catch {
    res.json({ status: 'error', error: 'Could not read analysis file' });
  }
}
