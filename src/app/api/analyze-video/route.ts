import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { env } from '~/env';

const genAI = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { prompt, videoData, youtubeUrl } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: '请提供分析指令' },
        { status: 400 }
      );
    }

    let response;

    if (youtubeUrl) {
      // Analyze YouTube video
      response = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { text: prompt },
          {
            fileData: {
              fileUri: youtubeUrl,
            },
          },
        ],
      });
    } else if (videoData) {
      // Analyze uploaded video
      response = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            inlineData: {
              mimeType: 'video/mp4',
              data: videoData,
            },
          },
          { text: prompt },
        ],
      });
    } else {
      return NextResponse.json(
        { error: '请提供视频数据或YouTube链接' },
        { status: 400 }
      );
    }

    if (!response.text) {
      throw new Error('没有生成分析结果');
    }

    return NextResponse.json({ text: response.text });
  } catch (error) {
    console.error('分析视频错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '分析视频时发生错误' },
      { status: 500 }
    );
  }
}
