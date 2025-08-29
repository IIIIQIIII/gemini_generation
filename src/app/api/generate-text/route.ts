import { type NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { env } from '~/env';

const genAI = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

interface GenerateTextRequest {
  prompt: string;
}

export async function POST(request: NextRequest) {
  try {
    const { prompt }: GenerateTextRequest = await request.json() as GenerateTextRequest;

    if (!prompt) {
      return NextResponse.json(
        { error: '请提供文本提示' },
        { status: 400 }
      );
    }

    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    if (!response.text) {
      throw new Error('没有生成文本内容');
    }

    return NextResponse.json({ text: response.text });
  } catch (error) {
    console.error('生成文本错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成文本时发生错误' },
      { status: 500 }
    );
  }
}
