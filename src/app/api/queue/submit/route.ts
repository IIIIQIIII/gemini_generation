import { NextRequest, NextResponse } from 'next/server';
import { queueManager } from '~/lib/queue';
import { headers } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { endpoint, data } = await request.json();
    
    if (!endpoint || !data) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 验证 endpoint 是否支持
    const supportedEndpoints = [
      'generate-text',
      'generate-image', 
      'edit-image',
      'generate-video',
      'volcengine-image',
      'volcengine-video',
      'qianfan-video',
      'speech-synthesize',
      'analyze-video',
      'analyze-image',
      'subtitle-submit'
    ];

    if (!supportedEndpoints.includes(endpoint)) {
      return NextResponse.json(
        { error: `不支持的端点: ${endpoint}` },
        { status: 400 }
      );
    }

    // 生成用户ID（基于IP和User-Agent）
    const headersList = await headers();
    const userAgent = headersList.get('user-agent') || '';
    const forwardedFor = headersList.get('x-forwarded-for') || '';
    const realIp = headersList.get('x-real-ip') || '';
    const clientIp = headersList.get('cf-connecting-ip') || ''; // Cloudflare IP
    
    // 使用多个IP源来生成更唯一的用户ID
    const ipSources = [forwardedFor, realIp, clientIp].filter(Boolean);
    const primaryIp = ipSources[0] || 'unknown';
    const userId = `${primaryIp}-${userAgent.slice(-20)}`.replace(/[^a-zA-Z0-9-]/g, '');

    // 添加到队列
    const itemId = await queueManager.enqueue(
      userId,
      endpoint,
      data
    );

    return NextResponse.json({
      success: true,
      itemId,
      message: '请求已加入队列'
    });

  } catch (error) {
    console.error('Queue submit error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '队列提交失败' },
      { status: 500 }
    );
  }
}
