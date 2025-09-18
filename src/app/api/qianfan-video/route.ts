import { NextRequest, NextResponse } from 'next/server';

const QIANFAN_API_BASE = 'https://qianfan.baidubce.com/video/generations';

interface QianfanVideoRequest {
  model: string;
  content: Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
    };
  }>;
  duration?: number;
  model_parameters?: {
    [key: string]: any;
  };
}

interface QianfanVideoResponse {
  id: string;
  task_id: string;
}

interface QianfanTaskStatusResponse {
  id: string;
  task_id: string;
  model: string;
  status: 'pending' | 'queued' | 'running' | 'succeeded' | 'failed';
  created_at: number;
  updated_at: number;
  content?: {
    video_url: string;
  };
  duration: number;
  width: string;
  height: string;
  error?: {
    code?: string;
    message?: string;
    details?: any;
  };
  message?: string;
}

// Utility function for retry with exponential backoff and rate limit handling
async function retryWithBackoff<T>(
  operation: () => Promise<T>, 
  maxRetries = 2, 
  baseDelay = 5000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Check if it's a rate limit error
      const isRateLimit = lastError.message.includes('Rate limit reached') || 
                         lastError.message.includes('rate_limit_exceeded') ||
                         lastError.message.includes('RPM');
      
      if (attempt === maxRetries) {
        if (isRateLimit) {
          throw new Error('API请求频率过高，请等待1-2分钟后重试。建议检查您的API配额设置。');
        }
        break;
      }
      
      // For rate limit errors, use longer delays
      let delay: number;
      if (isRateLimit) {
        delay = 60000 + Math.random() * 30000; // 60-90 seconds for rate limits
        console.log(`Qianfan API rate limit reached, waiting ${Math.round(delay/1000)}s before retry...`);
      } else {
        delay = baseDelay * Math.pow(2, attempt) + Math.random() * 2000;
        console.log(`Qianfan API attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms...`);
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

export async function POST(request: NextRequest) {
  try {
    const { 
      prompt, 
      model = 'musesteamer-2.0-turbo-i2v-audio',
      images = [],
      config = {}
    } = await request.json();

    if (!prompt && images.length === 0) {
      return NextResponse.json(
        { error: '请提供视频描述或上传图片' },
        { status: 400 }
      );
    }

    const qianfanApiKey = process.env.QIANFAN_API_KEY;
    if (!qianfanApiKey) {
      return NextResponse.json(
        { error: 'Qianfan API Key 未配置，请在环境变量中设置 QIANFAN_API_KEY' },
        { status: 500 }
      );
    }

    // Validate model
    const validModels = [
      'musesteamer-2.0-turbo-i2v-audio',
      'musesteamer-2.0-turbo-i2v',
      'musesteamer-2.0-lite-i2v',
      'musesteamer-2.0-pro-i2v',
      'musesteamer-2.0-turbo-i2v-effect'
    ];
    
    if (!validModels.includes(model)) {
      return NextResponse.json(
        { error: '无效的模型选择' },
        { status: 400 }
      );
    }

    // Prepare content array
    const content: QianfanVideoRequest['content'] = [];
    
    // Add text content if provided
    if (prompt) {
      content.push({
        type: 'text',
        text: prompt.trim()
      });
    }

    // Add image content if provided
    if (images && images.length > 0) {
      for (const imageData of images) {
        let imageUrl: string;

        // Handle different image input formats
        if (typeof imageData === 'string') {
          // Already a URL or base64 string
          imageUrl = imageData;
        } else if (imageData.url) {
          imageUrl = imageData.url;
        } else if (imageData.imageBytes && imageData.mimeType) {
          // Convert base64 to data URL format
          imageUrl = `data:${imageData.mimeType};base64,${imageData.imageBytes}`;
        } else {
          throw new Error('Invalid image data format');
        }

        content.push({
          type: 'image_url',
          image_url: {
            url: imageUrl
          }
        });
      }
    }

    // Prepare request body for Qianfan API
    const requestBody: QianfanVideoRequest = {
      model,
      content
    };

    // Add duration if specified and supported by model
    if (config.duration) {
      const supportedDurations = model === 'musesteamer-2.0-turbo-i2v-audio' ? [5, 10] : [5];
      if (supportedDurations.includes(config.duration)) {
        requestBody.duration = config.duration;
      }
    }

    // Add model-specific parameters if provided
    if (config.model_parameters && Object.keys(config.model_parameters).length > 0) {
      requestBody.model_parameters = config.model_parameters;
    }

    console.log('Qianfan API request:', JSON.stringify(requestBody, null, 2));

    // Make request to Qianfan API
    const response = await retryWithBackoff(async () => {
      console.log(`Making Qianfan API request to: ${QIANFAN_API_BASE}`);
      console.log('Request headers:', {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${qianfanApiKey.substring(0, 10)}...` // Log only first 10 chars for security
      });
      
      const res = await fetch(QIANFAN_API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${qianfanApiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log(`Qianfan API response status: ${res.status} ${res.statusText}`);
      console.log('Response headers:', Object.fromEntries(res.headers.entries()));

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Qianfan API error response body:', errorText);
        
        let errorMessage: string;
        let errorDetails: any = null;
        
        try {
          const errorData = JSON.parse(errorText);
          console.error('Parsed Qianfan API error data:', JSON.stringify(errorData, null, 2));
          
          errorMessage = errorData.error?.message || errorData.message || errorText;
          errorDetails = {
            code: errorData.error?.code || errorData.code,
            type: errorData.error?.type || errorData.type,
            full_response: errorData,
            status: res.status,
            statusText: res.statusText
          };
        } catch (parseError) {
          console.error('Failed to parse Qianfan error response:', parseError);
          errorMessage = errorText || `HTTP ${res.status}: ${res.statusText}`;
          errorDetails = {
            raw_response: errorText,
            status: res.status,
            statusText: res.statusText,
            parse_error: parseError instanceof Error ? parseError.message : 'Unknown parse error'
          };
        }
        
        const enhancedError = new Error(`Qianfan API 错误: ${errorMessage}`) as Error & { details?: any };
        enhancedError.details = errorDetails;
        throw enhancedError;
      }

      const responseData = await res.json();
      console.log('Qianfan API success response:', JSON.stringify(responseData, null, 2));
      return responseData;
    }, 3, 2000);

    const data = response as QianfanVideoResponse;

    if (!data.task_id) {
      throw new Error('Qianfan API 返回无效响应');
    }

    console.log('Qianfan video generation task created:', data.task_id);

    return NextResponse.json({
      taskId: data.task_id,
      status: 'processing',
      message: '视频生成任务已创建，正在处理中...',
      model
    });

  } catch (error) {
    console.error('Qianfan video generation error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Qianfan 视频生成时发生错误',
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

    const qianfanApiKey = process.env.QIANFAN_API_KEY;
    if (!qianfanApiKey) {
      return NextResponse.json(
        { error: 'Qianfan API Key 未配置' },
        { status: 500 }
      );
    }

    // Query task status from Qianfan API
    const response = await retryWithBackoff(async () => {
      console.log(`Querying Qianfan task status for taskId: ${taskId}`);
      console.log(`API endpoint: ${QIANFAN_API_BASE}?task_id=${encodeURIComponent(taskId)}`);
      
      const res = await fetch(`${QIANFAN_API_BASE}?task_id=${encodeURIComponent(taskId)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${qianfanApiKey}`,
        },
      });

      console.log(`Qianfan task query response status: ${res.status} ${res.statusText}`);

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Qianfan task query error response:', errorText);
        
        let errorMessage: string;
        let errorDetails: any = null;
        
        try {
          const errorData = JSON.parse(errorText);
          console.error('Parsed Qianfan task query error:', JSON.stringify(errorData, null, 2));
          
          errorMessage = errorData.error?.message || errorData.message || errorText;
          errorDetails = {
            code: errorData.error?.code || errorData.code,
            type: errorData.error?.type || errorData.type,
            full_response: errorData,
            status: res.status,
            statusText: res.statusText
          };
        } catch (parseError) {
          console.error('Failed to parse Qianfan task query error response:', parseError);
          errorMessage = errorText || `HTTP ${res.status}: ${res.statusText}`;
          errorDetails = {
            raw_response: errorText,
            status: res.status,
            statusText: res.statusText,
            parse_error: parseError instanceof Error ? parseError.message : 'Unknown parse error'
          };
        }
        
        const enhancedError = new Error(`Qianfan API 查询错误: ${errorMessage}`) as Error & { details?: any };
        enhancedError.details = errorDetails;
        throw enhancedError;
      }

      const responseData = await res.json();
      console.log('Qianfan task query success response:', JSON.stringify(responseData, null, 2));
      return responseData;
    }, 3, 1000);

    const data = response as QianfanTaskStatusResponse;

    console.log('Qianfan task status:', JSON.stringify(data, null, 2));

    // Log detailed information for failed tasks
    if (data.status === 'failed') {
      console.error('Qianfan task failed - detailed info:');
      console.error('Task ID:', data.task_id);
      console.error('Model:', data.model);
      console.error('Created at:', new Date(data.created_at));
      console.error('Updated at:', new Date(data.updated_at));
      console.error('Error details:', data.error);
      console.error('Message:', data.message);
      console.error('Content:', data.content);
    }

    // Return standardized response
    const result = {
      taskId: data.task_id,
      model: data.model,
      status: data.status,
      created_at: data.created_at,
      updated_at: data.updated_at
    };

    // Add error information for failed tasks
    if (data.status === 'failed') {
      return NextResponse.json({
        ...result,
        error: {
          message: data.error?.message || data.message || '视频生成失败，无详细错误信息',
          code: data.error?.code,
          details: data.error?.details,
          full_error: data.error
        },
        failed: true
      });
    }

    // Add video content if completed
    if (data.status === 'succeeded' && data.content?.video_url) {
      return NextResponse.json({
        ...result,
        videoUri: data.content.video_url,
        duration: data.duration,
        width: data.width,
        height: data.height,
        completed: true
      });
    }

    // Return processing status
    return NextResponse.json(result);

  } catch (error) {
    console.error('Qianfan task query error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Qianfan 任务查询时发生错误',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
