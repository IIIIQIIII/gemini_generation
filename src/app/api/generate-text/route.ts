import { type NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { env } from '~/env';
import fs from 'fs';
import path from 'path';
import os from 'os';

interface GenerateTextRequest {
  prompt: string;
  apiKey?: string;
  useVertexAI?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, apiKey: userApiKey, useVertexAI }: GenerateTextRequest = await request.json() as GenerateTextRequest;

    if (!prompt) {
      return NextResponse.json(
        { error: '请提供文本提示' },
        { status: 400 }
      );
    }

    let genAI: GoogleGenAI;

    // Determine whether to use Vertex AI or API Key mode
    const shouldUseVertexAI = useVertexAI || (
      env.GOOGLE_GENAI_USE_VERTEXAI === 'true' && 
      env.GOOGLE_CLOUD_PROJECT && 
      env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    );

    if (shouldUseVertexAI) {
      // Use Vertex AI mode
      if (!env.GOOGLE_CLOUD_PROJECT || !env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
        return NextResponse.json(
          { error: 'Vertex AI 配置不完整，缺少必要的环境变量' },
          { status: 400 }
        );
      }

      // Parse service account credentials from environment
      let credentials;
      try {
        credentials = JSON.parse(env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
      } catch (error) {
        return NextResponse.json(
          { error: 'Vertex AI 服务账号凭据解析失败' },
          { status: 500 }
        );
      }

      // Create temporary credentials file for Google Cloud authentication
      const tempDir = os.tmpdir();
      const credentialsPath = path.join(tempDir, `gcp-credentials-${Date.now()}.json`);
      
      try {
        // Write credentials to temporary file
        fs.writeFileSync(credentialsPath, env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
        
        // Set environment variable for Google Cloud authentication
        process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
        
        // Initialize GoogleGenAI with Vertex AI configuration
        genAI = new GoogleGenAI({
          vertexai: true,
          project: env.GOOGLE_CLOUD_PROJECT,
          location: env.GOOGLE_CLOUD_LOCATION || 'global',
        });
        
        // Clean up temporary file after a delay (in case of concurrent requests)
        setTimeout(() => {
          try {
            if (fs.existsSync(credentialsPath)) {
              fs.unlinkSync(credentialsPath);
            }
          } catch (cleanupError) {
            console.warn('Failed to cleanup temporary credentials file:', cleanupError);
          }
        }, 5000);
        
      } catch (fileError) {
        return NextResponse.json(
          { error: '无法创建临时凭据文件' },
          { status: 500 }
        );
      }
    } else {
      // Use API Key mode
      const apiKey = userApiKey || env.GEMINI_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ 
          error: 'API Key 未配置，请提供有效的API Key或启用Vertex AI模式' 
        }, { status: 400 });
      }

      genAI = new GoogleGenAI({ apiKey });
    }

    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    if (!response.text) {
      throw new Error('没有生成文本内容');
    }

    return NextResponse.json({ 
      text: response.text,
      mode: shouldUseVertexAI ? 'vertex-ai' : 'api-key'
    });
  } catch (error) {
    console.error('生成文本错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成文本时发生错误' },
      { status: 500 }
    );
  }
}
