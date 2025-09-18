import { NextRequest, NextResponse } from 'next/server';
import { queueManager } from '~/lib/queue';
import { headers } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('itemId');
    const userId = searchParams.get('userId');

    if (itemId) {
      // 获取特定队列项目状态
      const item = queueManager.getQueueItem(itemId);
      if (!item) {
        return NextResponse.json(
          { error: '队列项目不存在' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        item: {
          id: item.id,
          status: item.status,
          result: item.result,
          error: item.error,
          timestamp: item.timestamp
        }
      });
    }

    if (userId) {
      // 获取用户队列状态
      const status = queueManager.getQueueStatus(userId);
      return NextResponse.json({
        success: true,
        status
      });
    }

    // 获取全局队列状态
    const status = queueManager.getQueueStatus();
    return NextResponse.json({
      success: true,
      status
    });

  } catch (error) {
    console.error('Queue status error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取队列状态失败' },
      { status: 500 }
    );
  }
}

// 添加 POST 方法用于批量获取状态
export async function POST(request: NextRequest) {
  try {
    const { itemIds, userIds } = await request.json();

    const results: any = {};

    if (itemIds && Array.isArray(itemIds)) {
      results.items = {};
      for (const itemId of itemIds) {
        const item = queueManager.getQueueItem(itemId);
        if (item) {
          results.items[itemId] = {
            id: item.id,
            status: item.status,
            result: item.result,
            error: item.error,
            timestamp: item.timestamp
          };
        }
      }
    }

    if (userIds && Array.isArray(userIds)) {
      results.userStatuses = {};
      for (const userId of userIds) {
        const status = queueManager.getQueueStatus(userId);
        results.userStatuses[userId] = status;
      }
    }

    return NextResponse.json({
      success: true,
      ...results
    });

  } catch (error) {
    console.error('Queue batch status error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '批量获取队列状态失败' },
      { status: 500 }
    );
  }
}
