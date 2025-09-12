import { NextRequest, NextResponse } from 'next/server';

const BYTEDANCE_BASE_URL = 'https://openspeech.bytedance.com/api/v1/vc';
const APPID = process.env.BYTEDANCE_APP_ID;
const ACCESS_TOKEN = process.env.BYTEDANCE_ACCESS_TOKEN;

export async function GET(request: NextRequest) {
  try {
    if (!APPID || !ACCESS_TOKEN) {
      return NextResponse.json(
        { error: '缺少 ByteDance API 配置信息' },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const taskId = searchParams.get('taskId');
    const blocking = searchParams.get('blocking') || '1';

    if (!taskId) {
      return NextResponse.json(
        { error: '缺少任务ID' },
        { status: 400 }
      );
    }

    // Construct query URL
    const queryUrl = new URL(`${BYTEDANCE_BASE_URL}/query`);
    queryUrl.searchParams.append('appid', APPID);
    queryUrl.searchParams.append('id', taskId);
    queryUrl.searchParams.append('blocking', blocking);

    // Query ByteDance API
    const response = await fetch(queryUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer; ${ACCESS_TOKEN}`,
        'Accept': '*/*',
        'Connection': 'keep-alive',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ByteDance Query API Error:', errorText);
      return NextResponse.json(
        { error: `查询服务错误: ${response.status}` },
        { status: response.status }
      );
    }

    const result = await response.json();

    if (result.code === 2000) {
      // Still processing
      return NextResponse.json({
        status: 'processing',
        message: '正在处理中，请稍候...',
        taskId: result.id
      });
    }

    if (result.code !== 0) {
      return NextResponse.json(
        { error: `查询失败: ${result.message}` },
        { status: 400 }
      );
    }

    // Success - return the subtitle results
    return NextResponse.json({
      status: 'completed',
      taskId: result.id,
      duration: result.duration,
      utterances: result.utterances,
      message: '字幕生成完成'
    });

  } catch (error) {
    console.error('Subtitle query error:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
