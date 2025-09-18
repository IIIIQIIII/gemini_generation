'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '~/components/ui/Card';

interface GlobalQueueStatusProps {
  className?: string;
}

export function GlobalQueueStatus({ className }: GlobalQueueStatusProps) {
  const [status, setStatus] = useState<{
    totalInQueue: number;
    currentlyProcessing: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/queue/status');
        const data = await response.json();
        
        if (response.ok && data.status) {
          setStatus({
            totalInQueue: data.status.totalInQueue,
            currentlyProcessing: data.status.currentlyProcessing
          });
        }
      } catch (error) {
        console.warn('Failed to fetch global queue status:', error);
      } finally {
        setLoading(false);
      }
    };

    // 立即获取一次
    fetchStatus();

    // 每10秒更新一次
    const interval = setInterval(fetchStatus, 10000);

    return () => clearInterval(interval);
  }, []);

  // 如果加载中或者没有队列活动，不显示
  if (loading || !status || (status.totalInQueue === 0 && status.currentlyProcessing === 0)) {
    return null;
  }

  return (
    <Card className={`w-full ${className || ''}`}>
      <CardContent className="p-3">
        <div className="flex items-center justify-center space-x-4 text-sm">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
            <span className="text-gray-600">队列中:</span>
            <span className="font-medium text-orange-600">{status.totalInQueue}</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
            <span className="text-gray-600">处理中:</span>
            <span className="font-medium text-blue-600">{status.currentlyProcessing}</span>
          </div>
          <div className="text-xs text-gray-500">
            最多同时处理 2 个请求
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
