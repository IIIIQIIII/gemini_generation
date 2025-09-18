import { type NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { env } from '~/env';
import fs from 'fs';
import path from 'path';
import os from 'os';

interface AnalyzeVideoRequest {
  prompt: string;
  videoData?: string;
  youtubeUrl?: string;
  apiKey?: string;
  useVertexAI?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, videoData, youtubeUrl, apiKey: userApiKey, useVertexAI }: AnalyzeVideoRequest = await request.json() as AnalyzeVideoRequest;

    if (!prompt) {
      return NextResponse.json(
        { error: '请提供分析指令' },
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

    let response;

    if (youtubeUrl) {
      console.log('分析 YouTube 视频:', youtubeUrl);
      // Analyze YouTube video
      response = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { text: prompt },
          {
            fileData: {
              fileUri: youtubeUrl,
            },
          },
        ],
      });
    } else if (videoData) {
      console.log('分析上传视频 - 数据长度:', videoData.length);
      console.log('视频数据前100字符:', videoData.substring(0, 100));
      console.log('视频数据是否包含无效字符:', !/^[A-Za-z0-9+/]*={0,2}$/.test(videoData.substring(0, 100)));
      
      // 清理视频数据 - 移除可能的无效字符
      const cleanVideoData = videoData.replace(/[^A-Za-z0-9+/=]/g, '');
      console.log('清理后数据长度:', cleanVideoData.length);
      console.log('原始与清理后长度差异:', videoData.length - cleanVideoData.length);

      // Analyze uploaded video
      response = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            inlineData: {
              mimeType: 'video/mp4',
              data: cleanVideoData,
            },
          },
          { text: prompt },
        ],
      });
    } else {
      return NextResponse.json(
        { error: '请提供视频数据或YouTube链接' },
        { status: 400 }
      );
    }

    if (!response.text) {
      throw new Error('没有生成分析结果');
    }

    return NextResponse.json({ 
      text: response.text,
      mode: shouldUseVertexAI ? 'vertex-ai' : 'api-key'
    });
  } catch (error) {
    console.error('分析视频详细错误信息:');
    console.error('错误类型:', error?.constructor?.name);
    console.error('错误消息:', error instanceof Error ? error.message : String(error));
    console.error('错误堆栈:', error instanceof Error ? error.stack : 'No stack');
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : '分析视频时发生错误',
        errorType: error?.constructor?.name,
        details: 'Check server logs for detailed error information'
      },
      { status: 500 }
    );
  }
}
