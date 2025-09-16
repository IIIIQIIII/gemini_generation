import { type NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { env } from '~/env';

const genAI = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

interface AnalyzeVideoRequest {
  prompt: string;
  videoData?: string;
  youtubeUrl?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, videoData, youtubeUrl }: AnalyzeVideoRequest = await request.json() as AnalyzeVideoRequest;

    if (!prompt) {
      return NextResponse.json(
        { error: '请提供分析指令' },
        { status: 400 }
      );
    }

    let response;

    if (youtubeUrl) {
      console.log('分析 YouTube 视频:', youtubeUrl);
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
      console.log('分析上传视频 - 数据长度:', videoData.length);
      console.log('视频数据前100字符:', videoData.substring(0, 100));
      console.log('视频数据是否包含无效字符:', !/^[A-Za-z0-9+/]*={0,2}$/.test(videoData.substring(0, 100)));
      
      // 清理视频数据 - 移除可能的无效字符
      const cleanVideoData = videoData.replace(/[^A-Za-z0-9+/=]/g, '');
      console.log('清理后数据长度:', cleanVideoData.length);
      console.log('原始与清理后长度差异:', videoData.length - cleanVideoData.length);

      // Analyze uploaded video
      response = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            inlineData: {
              mimeType: 'video/mp4',
              data: cleanVideoData,
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
    console.error('分析视频详细错误信息:');
    console.error('错误类型:', error?.constructor?.name);
    console.error('错误消息:', error instanceof Error ? error.message : String(error));
    console.error('错误堆栈:', error instanceof Error ? error.stack : 'No stack');
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : '分析视频时发生错误',
        errorType: error?.constructor?.name,
        details: 'Check server logs for detailed error information'
      },
      { status: 500 }
    );
  }
}
