import { type NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { env } from '~/env';

const genAI = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

interface GenerateImageRequest {
  prompt: string;
}

export async function POST(request: NextRequest) {
  try {
    const { prompt }: GenerateImageRequest = await request.json() as GenerateImageRequest;

    if (!prompt) {
      return NextResponse.json(
        { error: '请提供图片描述' },
        { status: 400 }
      );
    }

    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: prompt,
    });

    console.log('Image generation response:', JSON.stringify(response, null, 2));

    if (!response.candidates?.[0]?.content?.parts) {
      throw new Error('没有生成图片候选');
    }

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return NextResponse.json({ imageData: part.inlineData.data });
      }
    }

    throw new Error('没有生成图片数据');
  } catch (error) {
    console.error('生成图片错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成图片时发生错误' },
      { status: 500 }
    );
  }
}
