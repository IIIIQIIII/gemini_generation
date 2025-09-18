import { NextRequest, NextResponse } from 'next/server';
import { existsSync, statSync, createReadStream } from 'fs';

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
      const stats = statSync(videoPath);
      const fileSize = stats.size;
      const range = request.headers.get('range');

      // Prepare common headers
      const commonHeaders = {
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Content-Type',
        'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
      };

      // Handle Range requests for video streaming
      if (range && typeof range === 'string') {
        // Parse range header
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0] || "0", 10);
        const end = parts[1] && parts[1] !== "" ? parseInt(parts[1], 10) : Math.min(start + 1024 * 1024, fileSize - 1); // Default 1MB chunks
        const chunkSize = (end - start) + 1;

        console.log(`Range request: ${start}-${end}/${fileSize} (${chunkSize} bytes)`);

        // Create readable stream for the range
        const stream = createReadStream(videoPath, { start, end });

        return new NextResponse(stream as any, {
          status: 206, // Partial Content
          headers: {
            ...commonHeaders,
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Content-Length': chunkSize.toString(),
          },
        });
      }

      // No range request - return entire file
      const stream = createReadStream(videoPath);

      return new NextResponse(stream as any, {
        status: 200,
        headers: {
          ...commonHeaders,
          'Content-Length': fileSize.toString(),
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

// Handle OPTIONS requests for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
