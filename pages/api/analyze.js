import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';

export const config = {
  api: { bodyParser: true, responseLimit: false },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { path: videoPath } = req.body;

  if (!videoPath || !videoPath.startsWith('/tmp/')) {
    return res.status(400).json({ error: 'Invalid video path' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
  }

  try {
    const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // 1. Upload the video to Gemini Files API
    const uploadResponse = await fileManager.uploadFile(videoPath, {
      mimeType: 'video/mp4',
      displayName: 'clip-cutter-analysis',
    });

    // 2. Wait for Gemini to finish processing the video
    let file = await fileManager.getFile(uploadResponse.file.name);
    while (file.state === 'PROCESSING') {
      await new Promise((r) => setTimeout(r, 2500));
      file = await fileManager.getFile(uploadResponse.file.name);
    }

    if (file.state === 'FAILED') {
      return res.status(500).json({ error: 'Gemini failed to process the video' });
    }

    // 3. Ask Gemini for clip recommendations
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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

    // Parse JSON — strip any markdown fences if present
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Could not parse Gemini response' });
    }

    const suggestions = JSON.parse(jsonMatch[0]);

    // 4. Clean up the uploaded file from Gemini
    await fileManager.deleteFile(uploadResponse.file.name).catch(() => {});

    res.json({ suggestions });
  } catch (err) {
    console.error('[analyze]', err);
    res.status(500).json({ error: err.message || 'Analysis failed' });
  }
}
