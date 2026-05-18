import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);
const TMP_DIR = '/tmp/clip-cutter-videos';

export function analysisPath(fileName) {
  return path.join(TMP_DIR, fileName.replace('.mp4', '.analysis.json'));
}

export async function analyzeVideo(fileName) {
  const videoPath = path.join(TMP_DIR, fileName);
  const outPath = analysisPath(fileName);
  const previewPath = path.join(TMP_DIR, fileName.replace('.mp4', '.preview.mp4'));

  // Mark as processing immediately so the UI can show status
  fs.writeFileSync(outPath, JSON.stringify({ status: 'processing' }));

  try {
    // Step 1: Compress to a lightweight preview (640p, low bitrate)
    // Turns a 1.5GB file into ~100-150MB before sending to Gemini
    await execAsync(
      `ffmpeg -i "${videoPath}" -vf scale=640:-2 -c:v libx264 -preset ultrafast -crf 28 -c:a aac -b:a 64k -movflags +faststart "${previewPath}" -y`
    );

    const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Step 2: Upload compressed preview to Gemini Files API
    const uploadResponse = await fileManager.uploadFile(previewPath, {
      mimeType: 'video/mp4',
      displayName: 'clip-cutter-preview',
    });

    // Step 3: Wait for Gemini to finish processing the video
    let file = await fileManager.getFile(uploadResponse.file.name);
    while (file.state === 'PROCESSING') {
      await new Promise((r) => setTimeout(r, 2500));
      file = await fileManager.getFile(uploadResponse.file.name);
    }

    if (file.state === 'FAILED') throw new Error('Gemini failed to process the video');

    // Step 4: Ask Gemini for clip recommendations
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent([
      {
        fileData: {
          mimeType: uploadResponse.file.mimeType,
          fileUri: uploadResponse.file.uri,
        },
      },
      {
        text: `Watch this video and recommend the best moments to clip.

Return ONLY a valid JSON array with 3 to 6 suggestions, no extra text or markdown:
[{"start": 0, "end": 45, "title": "Short title max 6 words", "reason": "One sentence explaining why this moment is worth clipping."}]

Rules:
- start and end are in seconds (numbers, not strings)
- Each clip must be between 10 seconds and 3 minutes long
- Clips must not overlap
- Focus on: key insights, emotional moments, funny moments, important statements, action peaks, strong openings or closings
- title should be punchy and descriptive`,
      },
    ]);

    const text = result.response.text();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Could not parse Gemini response');

    const suggestions = JSON.parse(jsonMatch[0]);

    // Step 5: Save results and clean up
    fs.writeFileSync(outPath, JSON.stringify({ status: 'done', suggestions }));
    fs.unlink(previewPath, () => {});
    await fileManager.deleteFile(uploadResponse.file.name).catch(() => {});

  } catch (err) {
    console.error('[analyzeVideo]', err.message);
    fs.writeFileSync(outPath, JSON.stringify({ status: 'error', error: err.message }));
    fs.unlink(previewPath, () => {});
  }
}
