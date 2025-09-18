import { useState, useCallback } from 'react';

export interface QueueHookResult<T = any> {
  loading: boolean;
  error: string;
  result: T | null;
  progress: string;
  submitToQueue: (endpoint: string, data: any) => Promise<void>;
  clearResult: () => void;
}

export function useQueue<T = any>(): QueueHookResult<T> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<T | null>(null);
  const [progress, setProgress] = useState('');

  const submitToQueue = useCallback(async (endpoint: string, data: any) => {
    setLoading(true);
    setError('');
    setResult(null);
    setProgress('正在提交任务到队列...');

    try {
      // 第一步：提交任务到排队系统
      const submitResponse = await fetch('/api/queue/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint,
          data
        }),
      });

      const submitData = await submitResponse.json();

      if (!submitResponse.ok) {
        throw new Error(submitData.error || '提交任务到队列失败');
      }

      const itemId = submitData.itemId;
      setProgress('任务已提交，正在等待处理...');

      // 第二步：轮询任务状态
      const pollStatus = async (): Promise<void> => {
        try {
          const statusResponse = await fetch(`/api/queue/status?itemId=${itemId}`);
          const statusData = await statusResponse.json();

          if (!statusResponse.ok) {
            throw new Error(statusData.error || '获取任务状态失败');
          }

          const item = statusData.item;

          switch (item.status) {
            case 'queued':
              // 任务还在队列中，继续轮询
              setProgress('任务在队列中等待，正在排队...');
              setTimeout(pollStatus, 2000); // 2秒后再次检查
              break;
            case 'processing':
              // 任务正在处理中，继续轮询
              setProgress('任务正在处理中...');
              setTimeout(pollStatus, 1000); // 1秒后再次检查
              break;
            case 'completed':
              // 任务完成
              setResult(item.result);
              setProgress('任务完成！');
              setLoading(false);
              break;
            case 'failed':
              // 任务失败
              throw new Error(item.error || '任务处理失败');
            default:
              throw new Error('未知的任务状态');
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : '轮询任务状态时出错');
          setLoading(false);
          setProgress('');
        }
      };

      // 开始轮询
      pollStatus();

    } catch (err) {
      setError(err instanceof Error ? err.message : '提交任务时出错');
      setLoading(false);
      setProgress('');
    }
  }, []);

  const clearResult = useCallback(() => {
    setResult(null);
    setError('');
    setProgress('');
  }, []);

  return {
    loading,
    error,
    result,
    progress,
    submitToQueue,
    clearResult
  };
}

// 为了向后兼容，提供一些便捷的 hook
export function useTextGeneration() {
  return useQueue<{ text: string; mode: string }>();
}

export function useImageGeneration() {
  return useQueue<{ images: any[]; data?: any }>();
}

export function useVideoGeneration() {
  return useQueue<{ videoUri: string; videoFile?: any; localVideoPath?: string }>();
}

export function useVideoAnalysis() {
  return useQueue<{ text: string; mode?: string }>();
}

export function useSubtitleGeneration() {
  return useQueue<{ taskId: string; duration: number; utterances: any[] }>();
}
