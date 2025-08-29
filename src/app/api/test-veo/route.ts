import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { env } from '~/env';

const genAI = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

export async function GET(request: NextRequest) {
  try {
    console.log('Testing Veo API availability...');
    console.log('API Key present:', env.GEMINI_API_KEY ? 'Yes' : 'No');
    
    // Test a minimal video generation request
    const testConfig = {
      model: 'veo-3.0-fast-generate-preview',
      prompt: 'A simple test video of a flower blooming',
      config: {
        aspectRatio: '16:9'
      }
    };
    
    let testResult;
    try {
      console.log('Attempting to call generateVideos API...');
      testResult = await genAI.models.generateVideos(testConfig);
      console.log('API call successful:', !!testResult);
      
      return NextResponse.json({
        status: 'success',
        message: 'Veo API 可以访问',
        hasOperation: !!testResult,
        operationStarted: testResult ? 'Yes' : 'No'
      });
      
    } catch (apiError: any) {
      console.error('API Error Details:', {
        message: apiError.message,
        status: apiError.status,
        code: apiError.code,
        stack: apiError.stack?.substring(0, 500)
      });
      
      let errorType = 'unknown';
      let solution = '';
      
      if (apiError.message?.includes('not enabled') || apiError.message?.includes('permission')) {
        errorType = 'api_not_enabled';
        solution = '请访问 Google Cloud Console 启用 Generative Language API 和 Vertex AI API';
      } else if (apiError.message?.includes('quota') || apiError.message?.includes('billing')) {
        errorType = 'billing_issue';
        solution = 'Veo 是付费功能，请确保已设置有效的付费账户和足够的配额';
      } else if (apiError.message?.includes('fetch failed') || apiError.message?.includes('network')) {
        errorType = 'network_issue';
        solution = '网络连接问题，可能是网络限制或服务暂时不可用';
      } else if (apiError.message?.includes('not found') || apiError.message?.includes('404')) {
        errorType = 'model_not_found';
        solution = 'Veo 模型在您的地区可能不可用，或者需要特殊权限';
      }
      
      return NextResponse.json({
        status: 'error',
        errorType,
        message: apiError.message,
        solution,
        fullError: {
          message: apiError.message,
          status: apiError.status,
          code: apiError.code
        }
      });
    }
    
  } catch (error) {
    console.error('Test error:', error);
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      type: 'general_error'
    });
  }
}
