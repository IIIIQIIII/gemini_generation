import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json();

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
        model: 'gemini-1.5-flash',
        contents: 'Hello'
      });
      
      if (testResult && testResult.text) {
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
    } catch (apiError: any) {
      console.error('API Key validation error:', apiError);
      
      // Handle specific error types
      if (apiError.message?.includes('Invalid API key')) {
        return NextResponse.json({
          valid: false,
          error: 'API Key无效，请检查是否正确复制'
        });
      } else if (apiError.message?.includes('not enabled')) {
        return NextResponse.json({
          valid: false,
          error: 'API服务未启用，请在Google Cloud Console中启用Generative Language API'
        });
      } else if (apiError.message?.includes('quota')) {
        return NextResponse.json({
          valid: false,
          error: 'API配额不足，请检查您的Google Cloud账单设置'
        });
      } else if (apiError.message?.includes('fetch failed')) {
        return NextResponse.json({
          valid: false,
          error: '网络连接失败，请检查网络设置并重试'
        });
      } else {
        return NextResponse.json({
          valid: false,
          error: `API Key验证失败: ${apiError.message}`
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
