import { NextRequest } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { env } from '~/env.js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, imageData, imageUrl, analysisType = 'general', apiKey: userApiKey } = body;

    if (!prompt?.trim()) {
      return Response.json({ error: '请提供分析指令' }, { status: 400 });
    }

    if (!imageData && !imageUrl) {
      return Response.json({ error: '请提供图片数据或图片链接' }, { status: 400 });
    }

    // Use user-provided API key first, fallback to environment variable
    const apiKey = userApiKey || env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'API Key 未配置，请提供有效的API Key' }, { status: 400 });
    }

    const genAI = new GoogleGenAI({ apiKey });
    let model = 'gemini-2.5-flash';
    
    // Choose model based on analysis type (all use the same model for now)
    if (analysisType === 'detection') {
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
      finalPrompt = `${prompt}

请按照以下要求进行物体检测：
1. 根据上述指令，专门检测和识别相关的物体或区域
2. 为每个检测到的物体提供边界框坐标，格式为 [ymin, xmin, ymax, xmax]，坐标值标准化到 0-1000 范围
3. 只检测与分析指令相关的物体，不需要检测图片中的所有物体
4. 必须严格按照以下JSON格式输出：

{
  "objects": [
    {
      "label": "物体名称",
      "box_2d": [ymin, xmin, ymax, xmax],
      "confidence": 0.95
    }
  ]
}

请确保输出是有效的JSON格式，不要包含任何其他文字。专注于用户指令中要求的特定物体或区域。`;
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
