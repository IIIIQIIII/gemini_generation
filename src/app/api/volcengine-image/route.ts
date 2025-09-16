import { type NextRequest, NextResponse } from 'next/server';
import { env } from '~/env';

// Helper function to validate and format image data
function validateAndFormatImageData(imageData: string, imageIndex: number): string {
  if (!imageData) {
    throw new Error(`图片${imageIndex}数据为空`);
  }

  // Check if it's already a proper data URL
  if (imageData.startsWith('data:image/')) {
    // 使用与前端一致的宽松但安全的正则表达式
    const matches = imageData.match(/^data:image\/([^;]+);base64,(.+)$/);
    if (!matches) {
      throw new Error(`图片${imageIndex}格式错误：必须是有效的base64数据URL格式。当前格式：${imageData.substring(0, 50)}...`);
    }
    
    const format = matches[1]?.toLowerCase();
    const base64Data = matches[2]?.replace(/\s/g, ''); // 清理所有空白字符
    
    // Additional validation for extracted data
    if (!format || !base64Data) {
      throw new Error(`图片${imageIndex}格式解析失败`);
    }
    
    // Validate base64 data
    if (base64Data.length === 0) {
      throw new Error(`图片${imageIndex}的base64数据为空`);
    }
    
    // 清理后验证base64字符
    const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Pattern.test(base64Data)) {
      throw new Error(`图片${imageIndex}包含无效的base64字符`);
    }
    
    // 标准化格式 (jpg -> jpeg, 但保持其他格式如svg+xml)
    const normalizedFormat = format === 'jpg' ? 'jpeg' : format;
    return `data:image/${normalizedFormat};base64,${base64Data}`;
  }
  
  // Check if it's a HTTP URL
  if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
    // Basic URL validation
    try {
      new URL(imageData);
      return imageData;
    } catch {
      throw new Error(`图片${imageIndex}的URL格式错误`);
    }
  }
  
  // Assume it's raw base64 data, validate and add proper prefix
  const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Pattern.test(imageData)) {
    throw new Error(`图片${imageIndex}包含无效的base64字符`);
  }
  
  // Check if the base64 data is too short (likely invalid)
  if (imageData.length < 50) {
    throw new Error(`图片${imageIndex}的base64数据太短，可能无效`);
  }
  
  // Default to JPEG format for raw base64 data
  return `data:image/jpeg;base64,${imageData}`;
}

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

    // Add optional parameters if provided - now all images come as base64 from frontend
    if (image) {
      try {
        if (Array.isArray(image)) {
          // Handle multiple images - validate each base64 data URL
          const processedImages = image.map((img, index) => {
            if (typeof img !== 'string') {
              throw new Error(`图片${index + 1}数据格式错误：必须是字符串`);
            }
            
            // All images should now be base64 data URLs from frontend
            return validateAndFormatImageData(img, index + 1);
          });
          
          requestBody.image = processedImages;
        } else if (typeof image === 'string') {
          // Handle single image - validate base64 data URL
          requestBody.image = validateAndFormatImageData(image, 1);
        } else {
          throw new Error('图片数据格式错误：必须是字符串或字符串数组');
        }
      } catch (formatError) {
        console.error('Image format validation error:', formatError);
        const errorMessage = formatError instanceof Error ? formatError.message : '未知的图片格式错误';
        return NextResponse.json(
          { error: `图片格式验证失败: ${errorMessage}` },
          { status: 400 }
        );
      }
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
