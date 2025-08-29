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
      console.log(`Attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

export async function POST(request: NextRequest) {
  try {
    const { 
      prompt, 
      model = 'veo-3.0-fast-generate-preview',
      config = {},
      apiKey 
    } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: '请提供视频描述' },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: '请提供API Key' },
        { status: 401 }
      );
    }

    // Create GoogleGenAI client with user-provided API key
    const genAI = new GoogleGenAI({ apiKey });

    // Validate model
    const validModels = ['veo-3.0-fast-generate-preview', 'veo-2.0-generate-001'];
    if (!validModels.includes(model)) {
      return NextResponse.json(
        { error: '无效的模型选择' },
        { status: 400 }
      );
    }

    // Start video generation operation - use the same format as the working test
    const requestConfig: any = {
      model,
      prompt,
      config: {
        aspectRatio: config.aspectRatio || '16:9'
      }
    };

    // Add optional configuration parameters
    if (config.negativePrompt) {
      requestConfig.config.negativePrompt = config.negativePrompt;
    }
    if (config.personGeneration) {
      requestConfig.config.personGeneration = config.personGeneration;
    }

    console.log('Attempting to generate video with config:', JSON.stringify(requestConfig, null, 2));
    console.log('Using user-provided API key:', apiKey ? 'Present' : 'Missing');
    
    // Use retry logic for video generation request
    let operation = await retryWithBackoff(async () => {
      console.log('Initiating video generation request...');
      return await genAI.models.generateVideos(requestConfig);
    }, 3, 2000);
    
    console.log('Video generation operation started successfully:', JSON.stringify(operation, null, 2));

    if (!operation) {
      throw new Error('视频生成操作启动失败');
    }

    // Poll until the video is ready (with extended timeout for video generation)
    let attempts = 0;
    const maxAttempts = 120; // 20 minutes maximum wait time for video generation
    
    while (!operation.done && attempts < maxAttempts) {
      const waitTime = attempts < 6 ? 5000 : 15000; // First 30s check every 5s, then every 15s
      console.log(`等待视频生成完成... 尝试 ${attempts + 1}/${maxAttempts} (预计总时长: 2-10分钟)`);
      
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      
      // Use retry logic for polling operations
      try {
        operation = await retryWithBackoff(async () => {
          return await genAI.operations.getVideosOperation({ operation });
        }, 2, 1000); // Shorter retry for polling
        
        attempts++;
        
        // Log progress for debugging
        if (attempts % 4 === 0) {
          console.log(`视频生成进行中... 已等待 ${Math.floor(attempts * waitTime / 1000 / 60)} 分钟`);
        }
      } catch (error) {
        console.error('Error polling operation after retries:', error);
        attempts++; // Still count this as an attempt
        
        // Only break if we have consistent failures
        if (attempts > 10 && attempts % 3 === 0) {
          console.log('Multiple polling errors, but continuing...');
        }
        
        // Don't break the loop for network errors, just continue
        continue;
      }
    }

    if (!operation.done) {
      // Instead of failing, return the operation for client-side polling
      return NextResponse.json(
        { 
          message: '视频生成正在进行中，这可能需要2-10分钟时间',
          operationName: operation.name,
          status: 'processing',
          estimatedTime: '预计还需要几分钟',
          pollUrl: `/api/generate-video?operation=${encodeURIComponent(operation.name || '')}`
        },
        { status: 202 } // 202 Accepted - processing
      );
    }

    // Check if video was generated successfully
    if (!operation.response?.generatedVideos?.[0]?.video?.uri) {
      console.error('Video generation failed:', JSON.stringify(operation, null, 2));
      
      // Check for content filter issues
      if (operation.response?.raiMediaFilteredCount && 
          operation.response.raiMediaFilteredCount > 0 && 
          operation.response?.raiMediaFilteredReasons) {
        const filterReasons = operation.response.raiMediaFilteredReasons.join('; ');
        return NextResponse.json(
          { 
            error: `内容过滤问题: ${filterReasons}`,
            suggestion: '请修改提示词，避免可能触发安全过滤器的内容。尝试使用更具体、更安全的描述。',
            filterDetails: operation.response.raiMediaFilteredReasons
          },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: '视频生成失败，请检查提示词并重试' },
        { status: 500 }
      );
    }

    const videoFile = operation.response.generatedVideos[0].video;
    const originalVideoUri = videoFile.uri;
    
    // Download the video to local storage for reliable playback with retry logic
    try {
      const timestamp = Date.now();
      const localVideoPath = `/tmp/generated-video-${timestamp}.mp4`;
      
      console.log('Downloading video for local playback...');
      
      // Use retry logic for download operation
      await retryWithBackoff(async () => {
        console.log(`Attempting to download video to: ${localVideoPath}`);
        return await genAI.files.download({
          file: videoFile,
          downloadPath: localVideoPath,
        });
      }, 3, 2000);
      
      console.log(`Video downloaded to: ${localVideoPath}`);
      
      // Trigger automatic cleanup (don't wait for it)
      fetch('/api/cleanup-videos', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).catch(error => console.log('Cleanup warning:', error.message));
      
      // Return local video URL for immediate playback
      const localVideoUrl = `/api/local-video?path=${encodeURIComponent(localVideoPath)}`;
      
      return NextResponse.json({ 
        videoUri: localVideoUrl, // Use local URL for reliable playback
        originalVideoUri: originalVideoUri, // Keep original for backup
        localVideoPath: localVideoPath, // Local path info
        videoFile, // Include the full video file object for download
        model,
        operationName: operation.name,
        status: 'completed'
      });
      
    } catch (downloadError) {
      console.error('Failed to download video for local playback after retries:', downloadError);
      
      // Fallback to original approach if download fails completely
      return NextResponse.json({ 
        videoUri: originalVideoUri,
        videoFile,
        model,
        operationName: operation.name,
        status: 'completed',
        warning: '本地下载失败，使用原始视频链接。如果播放有问题，请尝试重新生成。'
      });
    }

  } catch (error) {
    console.error('生成视频错误:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : '生成视频时发生错误',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
