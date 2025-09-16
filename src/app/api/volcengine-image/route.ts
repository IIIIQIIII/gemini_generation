import { type NextRequest, NextResponse } from 'next/server';
import { env } from '~/env';

interface VolcengineImageRequest {
  model?: string;
  prompt: string;
  image?: string | string[];
  size?: string;
  sequential_image_generation?: 'auto' | 'disabled';
  sequential_image_generation_options?: {
    max_images?: number;
  };
  stream?: boolean;
  response_format?: 'url' | 'b64_json';
  watermark?: boolean;
}

interface VolcengineImageResponse {
  model: string;
  created: number;
  data: Array<{
    url?: string;
    b64_json?: string;
    size?: string;
  } | {
    error: {
      code: string;
      message: string;
    };
  }>;
  usage: {
    generated_images: number;
    output_tokens: number;
    total_tokens: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: VolcengineImageRequest = await request.json() as VolcengineImageRequest;
    
    const {
      model = 'doubao-seedream-4-0-250828',
      prompt,
      image,
      size = '2K',
      sequential_image_generation = 'disabled',
      sequential_image_generation_options,
      stream = false,
      response_format = 'b64_json',
      watermark = true
    } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: '请提供图片描述' },
        { status: 400 }
      );
    }

    const apiKey = env.VOLCENGINE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Volcengine API Key 未配置' }, { status: 400 });
    }

    // Prepare request body for Volcengine API
    const requestBody: VolcengineImageRequest = {
      model,
      prompt,
      size,
      sequential_image_generation,
      response_format,
      watermark
    };

    // Add optional parameters if provided
    if (image) {
      requestBody.image = image;
    }
    
    if (sequential_image_generation_options) {
      requestBody.sequential_image_generation_options = sequential_image_generation_options;
    }

    if (stream) {
      requestBody.stream = stream;
    }

    console.log('Volcengine request:', JSON.stringify(requestBody, null, 2));

    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json() as { error?: { code: string; message: string } };
      console.error('Volcengine API error:', errorData);
      return NextResponse.json(
        { error: errorData.error?.message || `API请求失败: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json() as VolcengineImageResponse;
    console.log('Volcengine response:', JSON.stringify(data, null, 2));

    // Handle errors in individual images
    const successfulImages = data.data.filter(item => !('error' in item));
    const errorImages = data.data.filter(item => 'error' in item);

    if (errorImages.length > 0) {
      console.warn('Some images failed to generate:', errorImages);
    }

    if (successfulImages.length === 0) {
      return NextResponse.json(
        { error: '所有图片生成失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        model: data.model,
        created: data.created,
        images: successfulImages,
        usage: data.usage,
        errors: errorImages
      }
    });

  } catch (error) {
    console.error('Volcengine image generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成图片时发生错误' },
      { status: 500 }
    );
  }
}
