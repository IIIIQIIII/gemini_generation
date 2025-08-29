import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { env } from '~/env';

const genAI = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { prompt, imageData } = await request.json();

    if (!prompt || !imageData) {
      return NextResponse.json(
        { error: '请提供编辑指令和图片数据' },
        { status: 400 }
      );
    }

    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: [
        { text: prompt },
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: imageData,
          },
        },
      ],
    });

    if (!response.candidates?.[0]?.content?.parts) {
      throw new Error('没有生成图片候选');
    }

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData?.data) {
        return NextResponse.json({ imageData: part.inlineData.data });
      }
    }

    throw new Error('没有生成编辑后的图片');
  } catch (error) {
    console.error('编辑图片错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '编辑图片时发生错误' },
      { status: 500 }
    );
  }
}
