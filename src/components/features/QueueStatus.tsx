'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/Card';

interface QueueStatusData {
  position: number;
  estimatedWaitTime: number;
  totalInQueue: number;
  currentlyProcessing: number;
}

interface QueueStatusProps {
  itemId?: string;
  userId?: string;
  onComplete?: (result: any) => void;
  onError?: (error: string) => void;
  className?: string;
}

export function QueueStatus({ itemId, userId, onComplete, onError, className }: QueueStatusProps) {
  const [status, setStatus] = useState<QueueStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [itemStatus, setItemStatus] = useState<string>('');

  useEffect(() => {
    if (!itemId && !userId) return;

    const pollStatus = async () => {
      try {
        const params = new URLSearchParams();
        if (itemId) params.append('itemId', itemId);
        if (userId) params.append('userId', userId);

        const response = await fetch(`/api/queue/status?${params}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || '获取队列状态失败');
        }

        if (itemId && data.item) {
          // 检查特定项目状态
          setItemStatus(data.item.status);
          
          if (data.item.status === 'completed') {
            onComplete?.(data.item.result);
            setLoading(false);
            return;
          } else if (data.item.status === 'failed') {
            onError?.(data.item.error || '请求失败');
            setLoading(false);
            return;
          }
        }

        if (data.status) {
          setStatus(data.status);
          setLoading(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取状态失败');
        setLoading(false);
      }
    };

    // 立即检查一次
    pollStatus();

    // 设置轮询
    const interval = setInterval(pollStatus, 2000); // 每2秒检查一次

    return () => clearInterval(interval);
  }, [itemId, userId, onComplete, onError]);

  if (loading) {
    return (
      <Card className={`w-full max-w-md mx-auto ${className || ''}`}>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm text-gray-600">正在检查队列状态...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`w-full max-w-md mx-auto ${className || ''}`}>
        <CardContent className="p-4">
          <div className="text-red-600 text-sm">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (!status) {
    return null;
  }

  const formatWaitTime = (seconds: number) => {
    if (seconds < 60) {
      return `约 ${seconds} 秒`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `约 ${minutes} 分 ${remainingSeconds} 秒`;
    }
  };

  const getStatusIcon = () => {
    if (itemStatus === 'processing') {
      return '⚡';
    }
    return '⏳';
  };

  const getStatusText = () => {
    if (itemStatus === 'processing') {
      return '正在处理';
    }
    return '排队中';
  };

  return (
    <Card className={`w-full max-w-md mx-auto ${className || ''}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center space-x-2">
          <div className="animate-pulse">{getStatusIcon()}</div>
          <span>{getStatusText()}</span>
        </CardTitle>
        <CardDescription>
          {itemStatus === 'processing' 
            ? '您的请求正在处理中，请耐心等待' 
            : '您的请求正在排队处理中，请耐心等待'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 排队位置 */}
        {status.position > 0 && (
          <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
            <span className="text-sm font-medium text-blue-900">排队位置</span>
            <span className="text-lg font-bold text-blue-600">
              #{status.position}
            </span>
          </div>
        )}

        {/* 预计等待时间 */}
        {status.estimatedWaitTime > 0 && (
          <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
            <span className="text-sm font-medium text-orange-900">预计等待时间</span>
            <span className="text-lg font-bold text-orange-600">
              {formatWaitTime(status.estimatedWaitTime)}
            </span>
          </div>
        )}

        {/* 队列信息 */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-2 bg-gray-50 rounded">
            <div className="text-gray-600">队列中</div>
            <div className="font-medium">{status.totalInQueue} 个请求</div>
          </div>
          <div className="p-2 bg-gray-50 rounded">
            <div className="text-gray-600">处理中</div>
            <div className="font-medium">{status.currentlyProcessing} 个请求</div>
          </div>
        </div>

        {/* 进度条 */}
        {status.position > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-600">
              <span>进度</span>
              <span>{status.position}/{status.totalInQueue + status.currentlyProcessing}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${Math.max(10, (1 - (status.position - 1) / Math.max(1, status.totalInQueue + status.currentlyProcessing)) * 100)}%` 
                }}
              ></div>
            </div>
          </div>
        )}

        {/* 提示信息 */}
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs text-yellow-800">
            💡 为了确保服务质量，我们限制了同时处理的请求数量。请保持页面打开，系统会自动处理您的请求。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
