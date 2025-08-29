import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoPath = searchParams.get('path');

    if (!videoPath) {
      return NextResponse.json(
        { error: '请提供视频路径' },
        { status: 400 }
      );
    }

    // Security check: ensure the path is within /tmp directory and is a .mp4 file
    if (!videoPath.startsWith('/tmp/') || !videoPath.endsWith('.mp4')) {
      return NextResponse.json(
        { error: '无效的视频路径' },
        { status: 403 }
      );
    }

    // Check if file exists
    if (!existsSync(videoPath)) {
      return NextResponse.json(
        { error: '视频文件不存在' },
        { status: 404 }
      );
    }

    console.log(`Serving local video: ${videoPath}`);

    try {
      // Read the video file
      const videoBuffer = await readFile(videoPath);

      // Return the video with proper headers
      return new NextResponse(videoBuffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': videoBuffer.length.toString(),
          'Cache-Control': 'public, max-age=3600',
          'Accept-Ranges': 'bytes',
          // Add CORS headers to prevent issues
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Range',
        },
      });

    } catch (readError) {
      console.error('Error reading video file:', readError);
      return NextResponse.json(
        { error: '无法读取视频文件' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Local video service error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : '本地视频服务错误'
      },
      { status: 500 }
    );
  }
}
