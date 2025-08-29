import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { env } from '~/env';

const genAI = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoUri = searchParams.get('uri');

    if (!videoUri) {
      return NextResponse.json(
        { error: '请提供视频URI' },
        { status: 400 }
      );
    }

    console.log('Proxying video from URI:', videoUri);

    // Simple redirect approach first - let the browser try direct access
    // This often works better than complex proxy logic
    try {
      return NextResponse.redirect(videoUri, 302);
    } catch (redirectError) {
      console.error('Redirect failed:', redirectError);
      
      // Return a response that tells the frontend to handle this differently
      return NextResponse.json(
        {
          error: 'proxy_failed',
          message: '视频代理失败，请尝试直接下载',
          originalUri: videoUri,
          suggestion: 'direct_access'
        },
        { status: 502 }
      );
    }

  } catch (error) {
    console.error('Video proxy error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : '视频代理服务错误',
        originalUri: request.nextUrl.searchParams.get('uri'),
        suggestion: 'try_download'
      },
      { status: 500 }
    );
  }
}
