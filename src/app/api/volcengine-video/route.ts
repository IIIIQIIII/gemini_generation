import { NextRequest, NextResponse } from 'next/server';

const VOLCENGINE_API_BASE = 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks';

interface VolcengineVideoRequest {
  model: string;
  content: Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
    };
    role?: 'first_frame' | 'last_frame' | 'reference_image';
  }>;
  callback_url?: string;
  return_last_frame?: boolean;
}

interface VolcengineVideoResponse {
  id: string;
}

interface VolcengineTaskStatusResponse {
  id: string;
  model: string;
  status: 'queued' | 'running' | 'cancelled' | 'succeeded' | 'failed';
  error?: {
    code: string;
    message: string;
  } | null;
  created_at: number;
  updated_at: number;
  content?: {
    video_url: string;
    last_frame_url?: string;
  };
  seed: number;
  resolution: string;
  ratio: string;
  duration: number;
  framespersecond: number;
  usage: {
    completion_tokens: number;
    total_tokens: number;
  };
}

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
      
      if (attempt === maxRetries) break;
      
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      console.log(`Volcengine API attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

// Convert file to base64
function fileToBase64(file: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${file.toString('base64')}`;
}

export async function POST(request: NextRequest) {
  try {
    const { 
      prompt, 
      model = 'doubao-seedance-1-0-pro-250528',
      images = [],
      config = {}
    } = await request.json();

    if (!prompt && images.length === 0) {
      return NextResponse.json(
        { error: '请提供视频描述或上传图片' },
        { status: 400 }
      );
    }

    const volcengineApiKey = process.env.VOLCENGINE_API_KEY;
    if (!volcengineApiKey) {
      return NextResponse.json(
        { error: 'Volcengine API Key 未配置' },
        { status: 500 }
      );
    }

    // Validate model
    const validModels = [
      'doubao-seedance-1-0-pro-250528',
      'doubao-seedance-1-0-lite-t2v-250428',
      'doubao-seedance-1-0-lite-i2v-250428',
      'wan2-1-14b-t2v',
      'wan2-1-14b-i2v',
      'wan2-1-14b-flf2v'
    ];
    
    if (!validModels.includes(model)) {
      return NextResponse.json(
        { error: '无效的模型选择' },
        { status: 400 }
      );
    }

    // Prepare content array
    const content: VolcengineVideoRequest['content'] = [];
    
    // Add text content with parameters if provided
    if (prompt) {
      let textContent = prompt.trim();
      
      // Add parameters to text if provided in config
      const params: string[] = [];
      if (config.resolution && config.resolution !== '720p') {
        params.push(`--rs ${config.resolution}`);
      }
      if (config.ratio && config.ratio !== '16:9') {
        params.push(`--rt ${config.ratio}`);
      }
      if (config.duration && config.duration !== 5) {
        params.push(`--dur ${config.duration}`);
      }
      if (config.framespersecond && config.framespersecond !== 24) {
        params.push(`--fps ${config.framespersecond}`);
      }
      if (config.watermark === true) {
        params.push('--wm true');
      }
      if (config.seed && config.seed !== -1) {
        params.push(`--seed ${config.seed}`);
      }
      if (config.camerafixed === true) {
        params.push('--cf true');
      }
      
      if (params.length > 0) {
        textContent += ' ' + params.join(' ');
      }
      
      content.push({
        type: 'text',
        text: textContent
      });
    }

    // Add image content if provided
    if (images && images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        const imageData = images[i];
        let imageUrl: string;
        let role: 'first_frame' | 'last_frame' | 'reference_image' | undefined;

        // Handle different image input formats
        if (typeof imageData === 'string') {
          // Already a URL or base64 string
          imageUrl = imageData;
        } else if (imageData.url) {
          imageUrl = imageData.url;
          role = imageData.role;
        } else if (imageData.imageBytes && imageData.mimeType) {
          // Convert base64 to data URL format
          imageUrl = `data:${imageData.mimeType};base64,${imageData.imageBytes}`;
          role = imageData.role;
        } else {
          throw new Error('Invalid image data format');
        }

        // Determine role based on model and image count
        if (!role) {
          if (model.includes('flf2v') && images.length === 2) {
            // First and last frame for flf2v models
            role = i === 0 ? 'first_frame' : 'last_frame';
          } else if (model.includes('i2v') && model.includes('lite') && images.length > 1) {
            // Reference images for lite i2v models
            role = 'reference_image';
          } else {
            // Default to first frame for single image
            role = 'first_frame';
          }
        }

        const imageContent: any = {
          type: 'image_url',
          image_url: {
            url: imageUrl
          }
        };

        // Add role if specified
        if (role) {
          imageContent.role = role;
        }

        content.push(imageContent);
      }
    }

    // Prepare request body for Volcengine API
    const requestBody: VolcengineVideoRequest = {
      model,
      content
    };

    // Add optional parameters
    if (config.return_last_frame === true && model.includes('lite-i2v')) {
      requestBody.return_last_frame = true;
    }

    console.log('Volcengine API request:', JSON.stringify(requestBody, null, 2));

    // Make request to Volcengine API
    const response = await retryWithBackoff(async () => {
      const res = await fetch(VOLCENGINE_API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${volcengineApiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errorText = await res.text();
        let errorMessage: string;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error?.message || errorData.message || errorText;
        } catch {
          errorMessage = errorText || `HTTP ${res.status}: ${res.statusText}`;
        }
        throw new Error(`Volcengine API 错误: ${errorMessage}`);
      }

      return res.json();
    }, 3, 2000);

    const data = response as VolcengineVideoResponse;

    if (!data.id) {
      throw new Error('Volcengine API 返回无效响应');
    }

    console.log('Volcengine video generation task created:', data.id);

    return NextResponse.json({
      taskId: data.id,
      status: 'processing',
      message: '视频生成任务已创建，正在处理中...',
      model
    });

  } catch (error) {
    console.error('Volcengine video generation error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Volcengine 视频生成时发生错误',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json(
        { error: '请提供任务 ID' },
        { status: 400 }
      );
    }

    const volcengineApiKey = process.env.VOLCENGINE_API_KEY;
    if (!volcengineApiKey) {
      return NextResponse.json(
        { error: 'Volcengine API Key 未配置' },
        { status: 500 }
      );
    }

    // Query task status from Volcengine API
    const response = await retryWithBackoff(async () => {
      const res = await fetch(`${VOLCENGINE_API_BASE}/${taskId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${volcengineApiKey}`,
        },
      });

      if (!res.ok) {
        const errorText = await res.text();
        let errorMessage: string;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error?.message || errorData.message || errorText;
        } catch {
          errorMessage = errorText || `HTTP ${res.status}: ${res.statusText}`;
        }
        throw new Error(`Volcengine API 查询错误: ${errorMessage}`);
      }

      return res.json();
    }, 3, 1000);

    const data = response as VolcengineTaskStatusResponse;

    console.log('Volcengine task status:', JSON.stringify(data, null, 2));

    // Return standardized response
    const result = {
      taskId: data.id,
      model: data.model,
      status: data.status,
      created_at: data.created_at,
      updated_at: data.updated_at,
      error: data.error,
      usage: data.usage
    };

    // Add video content if completed
    if (data.status === 'succeeded' && data.content?.video_url) {
      return NextResponse.json({
        ...result,
        videoUri: data.content.video_url,
        lastFrameUrl: data.content.last_frame_url,
        seed: data.seed,
        resolution: data.resolution,
        ratio: data.ratio,
        duration: data.duration,
        framespersecond: data.framespersecond,
        completed: true
      });
    }

    // Return processing status
    return NextResponse.json(result);

  } catch (error) {
    console.error('Volcengine task query error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Volcengine 任务查询时发生错误',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// DELETE method for canceling tasks
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json(
        { error: '请提供任务 ID' },
        { status: 400 }
      );
    }

    const volcengineApiKey = process.env.VOLCENGINE_API_KEY;
    if (!volcengineApiKey) {
      return NextResponse.json(
        { error: 'Volcengine API Key 未配置' },
        { status: 500 }
      );
    }

    // Cancel task via Volcengine API
    const response = await retryWithBackoff(async () => {
      const res = await fetch(`${VOLCENGINE_API_BASE}/${taskId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${volcengineApiKey}`,
        },
      });

      if (!res.ok) {
        const errorText = await res.text();
        let errorMessage: string;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error?.message || errorData.message || errorText;
        } catch {
          errorMessage = errorText || `HTTP ${res.status}: ${res.statusText}`;
        }
        throw new Error(`Volcengine API 取消错误: ${errorMessage}`);
      }

      return res.status === 204 ? {} : res.json();
    }, 3, 1000);

    console.log('Volcengine task canceled:', taskId);

    return NextResponse.json({
      taskId,
      status: 'cancelled',
      message: '任务已取消'
    });

  } catch (error) {
    console.error('Volcengine task cancel error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Volcengine 任务取消时发生错误',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
