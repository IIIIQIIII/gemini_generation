import { NextRequest } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { env } from '~/env.js';

export async function GET() {
  try {
    // 检查环境变量
    const apiKey = env.GEMINI_API_KEY;
    console.log('API Key from env:', apiKey ? `${apiKey.substring(0, 10)}...` : 'Not found');
    
    if (!apiKey) {
      return Response.json({ 
        error: 'GEMINI_API_KEY 未在环境变量中找到',
        envKeys: Object.keys(process.env).filter(key => key.includes('GEMINI')),
        envValue: process.env.GEMINI_API_KEY ? `${process.env.GEMINI_API_KEY.substring(0, 10)}...` : 'undefined'
      }, { status: 500 });
    }

    // 测试API调用
    const genAI = new GoogleGenAI({ apiKey });
    
    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ text: 'Hello, just testing API key!' }],
    });

    const text = result.text;

    return Response.json({ 
      success: true,
      apiKeyPrefix: `${apiKey.substring(0, 10)}...`,
      responseText: text,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('API test error:', error);
    
    return Response.json({
      error: 'API测试失败',
      details: error instanceof Error ? error.message : 'Unknown error',
      apiKeyPrefix: env.GEMINI_API_KEY ? `${env.GEMINI_API_KEY.substring(0, 10)}...` : 'Not found',
      envKeys: Object.keys(process.env).filter(key => key.includes('GEMINI')),
      envValue: process.env.GEMINI_API_KEY ? `${process.env.GEMINI_API_KEY.substring(0, 10)}...` : 'undefined'
    }, { status: 500 });
  }
}
