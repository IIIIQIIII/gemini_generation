import { type NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

interface ValidateKeyRequest {
  apiKey: string;
}

export async function POST(request: NextRequest) {
  try {
    const { apiKey }: ValidateKeyRequest = await request.json() as ValidateKeyRequest;

    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json(
        { valid: false, error: '请提供有效的API Key' },
        { status: 400 }
      );
    }

    // Validate the API key by making a simple test request
    try {
      const genAI = new GoogleGenAI({ apiKey });
      
      // Try to make a simple test request to validate the API key
      const testResult = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'Hello'
      });
      
      if (testResult?.text) {
        return NextResponse.json({
          valid: true,
          message: 'API Key验证成功',
          hasAccess: true
        });
      } else {
        return NextResponse.json({
          valid: false,
          error: 'API Key有效但无法访问模型，请检查权限设置'
        });
      }
    } catch (apiError: unknown) {
      console.error('API Key validation error:', apiError);
      
      // Handle specific error types
      if (apiError instanceof Error) {
        const errorMessage = apiError.message;
        
        if (errorMessage.includes('Invalid API key')) {
          return NextResponse.json({
            valid: false,
            error: 'API Key无效，请检查是否正确复制'
          });
        } else if (errorMessage.includes('not enabled')) {
          return NextResponse.json({
            valid: false,
            error: 'API服务未启用，请在Google Cloud Console中启用Generative Language API'
          });
        } else if (errorMessage.includes('quota')) {
          return NextResponse.json({
            valid: false,
            error: 'API配额不足，请检查您的Google Cloud账单设置'
          });
        } else if (errorMessage.includes('fetch failed')) {
          return NextResponse.json({
            valid: false,
            error: '网络连接失败，请检查网络设置并重试'
          });
        } else {
          return NextResponse.json({
            valid: false,
            error: `API Key验证失败: ${errorMessage}`
          });
        }
      } else {
        return NextResponse.json({
          valid: false,
          error: 'API Key验证失败: 未知错误'
        });
      }
    }
  } catch (error) {
    console.error('Validation endpoint error:', error);
    return NextResponse.json(
      { 
        valid: false,
        error: '验证过程中发生错误',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
