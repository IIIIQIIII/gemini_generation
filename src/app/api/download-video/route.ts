import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Utility function for retry with exponential backoff
async function retryWithBackoff<T>(
  operation: () => Promise<T>, 
  maxRetries = 3, 
  baseDelay = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on certain errors
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        if (errorMessage.includes('not enabled') || 
            errorMessage.includes('permission') ||
            errorMessage.includes('quota') ||
            errorMessage.includes('billing')) {
          throw error; // Don't retry permission/quota errors
        }
      }
      
      if (attempt === maxRetries) break;
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      console.log(`Download attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

export async function POST(request: NextRequest) {
  try {
    const { videoFile, localVideoPath, apiKey, videoUrl, provider } = await request.json();

    // For Volcengine videos, download from URL
    if (provider === 'volcengine' && videoUrl) {
      console.log('Downloading Volcengine video from URL:', videoUrl);
      
      try {
        const response = await retryWithBackoff(async () => {
          const res = await fetch(videoUrl);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          return res;
        }, 3, 2000);

        const videoBuffer = Buffer.from(await response.arrayBuffer());
        console.log(`Volcengine video downloaded, size: ${videoBuffer.length} bytes`);
        
        // Return the video file directly for download
        return new NextResponse(videoBuffer, {
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Disposition': `attachment; filename="volcengine-video-${Date.now()}.mp4"`,
            'Content-Length': videoBuffer.length.toString(),
          },
        });
      } catch (error) {
        console.error('Failed to download Volcengine video:', error);
        return NextResponse.json({
          error: '无法下载视频文件',
          message: '服务器下载失败，请尝试刷新页面重新生成视频',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    }

    // For Veo videos, use the existing logic
    if (!videoFile) {
      return NextResponse.json(
        { error: '请提供视频文件信息' },
        { status: 400 }
      );
    }

    console.log('Downloading Veo video from local storage:', { videoFile, localVideoPath });

    // Try to read from local storage first
    if (localVideoPath) {
      try {
        const fs = await import('fs');
        console.log(`Reading video from local path: ${localVideoPath}`);
        
        // Check if file exists
        if (fs.existsSync(localVideoPath)) {
          const videoBuffer = fs.readFileSync(localVideoPath);
          console.log(`Video read from local storage, size: ${videoBuffer.length} bytes`);
          
          // Return the video file directly for download
          return new NextResponse(videoBuffer, {
            headers: {
              'Content-Type': 'video/mp4',
              'Content-Disposition': `attachment; filename="generated-video-${Date.now()}.mp4"`,
              'Content-Length': videoBuffer.length.toString(),
            },
          });
        } else {
          console.log('Local video file not found, falling back to alternative method');
        }
      } catch (localError) {
        console.error('Failed to read local video file:', localError);
      }
    }

    // Fallback: Use the GenAI download method with user API key (which should work since it's authenticated)
    if (apiKey) {
      try {
        const genAI = new GoogleGenAI({ apiKey });
        const timestamp = Date.now();
        const tempDownloadPath = `/tmp/download-${timestamp}.mp4`;
        
        console.log('Using GenAI download method...');
        await retryWithBackoff(async () => {
          return await genAI.files.download({
            file: videoFile,
            downloadPath: tempDownloadPath,
          });
        }, 3, 2000);

        // Read the downloaded file and return it
        const fs = await import('fs');
        const videoBuffer = fs.readFileSync(tempDownloadPath);
        
        // Clean up the temp file
        try {
          fs.unlinkSync(tempDownloadPath);
        } catch (cleanupError) {
          console.log('Cleanup warning:', cleanupError);
        }
        
        console.log(`Video downloaded via GenAI, size: ${videoBuffer.length} bytes`);
        
        // Return the video file directly for download
        return new NextResponse(videoBuffer, {
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Disposition': `attachment; filename="generated-video-${Date.now()}.mp4"`,
            'Content-Length': videoBuffer.length.toString(),
          },
        });

      } catch (error) {
        console.error('GenAI download method failed:', error);
      }
    }

    // Final fallback: Return JSON with error
    return NextResponse.json({
      error: '无法下载视频文件',
      message: '服务器下载失败，请尝试刷新页面重新生成视频',
      details: 'All download methods failed'
    }, { status: 500 });

  } catch (error) {
    console.error('下载视频错误:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : '下载视频时发生错误',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
