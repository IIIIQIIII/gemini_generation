import { NextRequest, NextResponse } from 'next/server';

const BYTEDANCE_BASE_URL = 'https://openspeech.bytedance.com/api/v1/vc';
const APPID = process.env.BYTEDANCE_APP_ID;
const ACCESS_TOKEN = process.env.BYTEDANCE_ACCESS_TOKEN;

export async function POST(request: NextRequest) {
  try {
    if (!APPID || !ACCESS_TOKEN) {
      return NextResponse.json(
        { error: '缺少 ByteDance API 配置信息' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const language = formData.get('language') as string || 'zh-CN';
    const wordsPerLine = formData.get('words_per_line') as string || '15';
    const maxLines = formData.get('max_lines') as string || '1';
    const useItn = formData.get('use_itn') as string || 'true';
    const usePunc = formData.get('use_punc') as string || 'true';
    const captionType = formData.get('caption_type') as string || 'auto';

    if (!audioFile) {
      return NextResponse.json(
        { error: '请上传音频文件' },
        { status: 400 }
      );
    }

    // Prepare form data for ByteDance API
    const byteDanceFormData = new FormData();
    byteDanceFormData.append('audio', audioFile);

    // Construct URL with parameters
    const submitUrl = new URL(`${BYTEDANCE_BASE_URL}/submit`);
    submitUrl.searchParams.append('appid', APPID);
    submitUrl.searchParams.append('language', language);
    submitUrl.searchParams.append('words_per_line', wordsPerLine);
    submitUrl.searchParams.append('max_lines', maxLines);
    submitUrl.searchParams.append('use_itn', useItn);
    submitUrl.searchParams.append('use_punc', usePunc);
    submitUrl.searchParams.append('caption_type', captionType);

    // Submit to ByteDance API
    const response = await fetch(submitUrl.toString(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer; ${ACCESS_TOKEN}`,
        'Accept': '*/*',
        'Connection': 'keep-alive',
      },
      body: audioFile, // Send binary data directly
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ByteDance API Error:', errorText);
      return NextResponse.json(
        { error: `字幕生成服务错误: ${response.status}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    
    if (result.code !== 0) {
      return NextResponse.json(
        { error: `字幕生成失败: ${result.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      taskId: result.id,
      message: '任务提交成功，正在处理中...'
    });

  } catch (error) {
    console.error('Subtitle submit error:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
