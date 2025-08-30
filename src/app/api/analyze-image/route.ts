import { NextRequest } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { env } from '~/env.js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, imageData, imageUrl, analysisType = 'general' } = body;

    if (!prompt?.trim()) {
      return Response.json({ error: '请提供分析指令' }, { status: 400 });
    }

    if (!imageData && !imageUrl) {
      return Response.json({ error: '请提供图片数据或图片链接' }, { status: 400 });
    }

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'GEMINI_API_KEY 未配置' }, { status: 500 });
    }

    const genAI = new GoogleGenAI({ apiKey });
    let model = 'gemini-2.5-flash';
    
    // Choose model based on analysis type (all use the same model for now)
    if (analysisType === 'detection' || analysisType === 'segmentation') {
      model = 'gemini-2.5-flash';
    }

    let contents: any[] = [];

    // Handle image from URL
    if (imageUrl) {
      try {
        const response = await fetch(imageUrl);
        const imageArrayBuffer = await response.arrayBuffer();
        const base64ImageData = Buffer.from(imageArrayBuffer).toString('base64');
        
        // Determine MIME type from URL or default to jpeg
        let mimeType = 'image/jpeg';
        const urlLower = imageUrl.toLowerCase();
        if (urlLower.includes('.png')) mimeType = 'image/png';
        else if (urlLower.includes('.webp')) mimeType = 'image/webp';
        else if (urlLower.includes('.heic')) mimeType = 'image/heic';
        else if (urlLower.includes('.heif')) mimeType = 'image/heif';

        contents.push({
          inlineData: {
            mimeType,
            data: base64ImageData,
          },
        });
      } catch (error) {
        return Response.json({ error: '无法获取图片链接中的图片' }, { status: 400 });
      }
    }
    
    // Handle uploaded image data
    if (imageData) {
      contents.push({
        inlineData: {
          mimeType: 'image/jpeg', // Default, should be determined from file
          data: imageData,
        },
      });
    }

    // Add analysis-specific prompts
    let finalPrompt = prompt;
    if (analysisType === 'detection') {
      finalPrompt = `${prompt}\n\nDetect all prominent objects in the image. For each object, provide the bounding box coordinates in the format [ymin, xmin, ymax, xmax] normalized to 0-1000, along with the object label. Output as JSON format with "objects" array containing "label" and "box_2d" fields.`;
    } else if (analysisType === 'segmentation') {
      finalPrompt = `${prompt}\n\nProvide segmentation masks for the objects in the image. Output as JSON format with segmentation data including bounding boxes, labels, and masks.`;
    }

    contents.push({ text: finalPrompt });

    const result = await genAI.models.generateContent({
      model,
      contents,
    });

    const text = result.text;

    return Response.json({ 
      text,
      analysisType,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Image analysis error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return Response.json({ error: 'API密钥无效' }, { status: 401 });
      }
      if (error.message.includes('quota')) {
        return Response.json({ error: 'API配额已用完' }, { status: 429 });
      }
      if (error.message.includes('size')) {
        return Response.json({ error: '图片文件过大' }, { status: 413 });
      }
    }

    return Response.json(
      { error: '图片分析失败，请稍后重试' },
      { status: 500 }
    );
  }
}
