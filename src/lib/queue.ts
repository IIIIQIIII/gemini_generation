// 队列管理器 - 类似 Hugging Face Space 的排队系统
import { v4 as uuidv4 } from 'uuid';

export interface QueueItem {
  id: string;
  userId: string;
  endpoint: string;
  requestData: any;
  timestamp: number;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

export interface QueueStatus {
  position: number;
  estimatedWaitTime: number;
  totalInQueue: number;
  currentlyProcessing: number;
}

class QueueManager {
  private queue: QueueItem[] = [];
  private processing: Set<string> = new Set();
  private processingItems: Map<string, QueueItem> = new Map(); // 存储正在处理的项目
  private completed: Map<string, QueueItem> = new Map();
  private maxConcurrent: number;
  private processingTimes: number[] = []; // 记录处理时间用于估算等待时间
  private maxProcessingHistory = 50; // 最多保留50个处理时间记录
  private maxCompletedItems = 1000; // 最多保留1000个完成的项目

  constructor(maxConcurrent = 2) { // 默认最多同时处理2个请求
    this.maxConcurrent = maxConcurrent;
  }

  // 添加请求到队列
  async enqueue(
    userId: string,
    endpoint: string,
    requestData: any
  ): Promise<string> {
    const item: QueueItem = {
      id: uuidv4(),
      userId,
      endpoint,
      requestData,
      timestamp: Date.now(),
      status: 'queued'
    };

    this.queue.push(item);
    
    // 如果队列有空位且没有超过并发限制，立即处理
    if (this.processing.size < this.maxConcurrent) {
      // 异步处理，不阻塞返回
      setImmediate(() => this.processNext());
    }

    return item.id;
  }

  // 处理队列中的下一个请求
  private async processNext() {
    if (this.queue.length === 0 || this.processing.size >= this.maxConcurrent) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    item.status = 'processing';
    this.processing.add(item.id);
    this.processingItems.set(item.id, item); // 存储正在处理的项目

    try {
      const startTime = Date.now();
      
      // 根据 endpoint 调用相应的处理函数
      const result = await this.handleRequest(item.endpoint, item.requestData);
      
      const processingTime = Date.now() - startTime;
      this.recordProcessingTime(processingTime);
      
      item.result = result;
      item.status = 'completed';
      
      // 保存完成的项目
      this.completed.set(item.id, item);
      
    } catch (error) {
      item.error = error instanceof Error ? error.message : 'Unknown error';
      item.status = 'failed';
      
      // 也保存失败的项目
      this.completed.set(item.id, item);
    } finally {
      this.processing.delete(item.id);
      this.processingItems.delete(item.id); // 从处理中项目中移除
      
      // 处理下一个请求
      setTimeout(() => this.processNext(), 100);
      
      // 清理过多的完成项目
      this.cleanupCompleted();
    }
  }

  // 处理具体的 API 请求
  private async handleRequest(endpoint: string, requestData: any) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    switch (endpoint) {
      case 'generate-text':
        return await this.handleGenerateText(requestData, baseUrl);
      case 'generate-image':
        return await this.handleGenerateImage(requestData, baseUrl);
      case 'edit-image':
        return await this.handleEditImage(requestData, baseUrl);
      case 'analyze-video':
        return await this.handleAnalyzeVideo(requestData, baseUrl);
      case 'subtitle-submit':
        return await this.handleSubtitleSubmit(requestData, baseUrl);
      case 'generate-video':
        return await this.handleGenerateVideo(requestData, baseUrl);
      case 'volcengine-image':
        return await this.handleVolcengineImage(requestData, baseUrl);
      case 'volcengine-video':
        return await this.handleVolcengineVideo(requestData, baseUrl);
      case 'qianfan-video':
        return await this.handleQianfanVideo(requestData, baseUrl);
      case 'speech-synthesize':
        return await this.handleSpeechSynthesize(requestData);
      default:
        throw new Error(`Unknown endpoint: ${endpoint}`);
    }
  }

  // 处理文本生成
  private async handleGenerateText(data: any, baseUrl: string) {
    const response = await fetch(`${baseUrl}/api/generate-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Text generation failed');
    }
    
    return await response.json();
  }

  // 处理图片生成
  private async handleGenerateImage(data: any, baseUrl: string) {
    const response = await fetch(`${baseUrl}/api/generate-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Image generation failed');
    }
    
    return await response.json();
  }

  // 处理图片编辑
  private async handleEditImage(data: any, baseUrl: string) {
    const response = await fetch(`${baseUrl}/api/edit-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Image editing failed');
    }
    
    return await response.json();
  }

  // 处理视频分析
  private async handleAnalyzeVideo(data: any, baseUrl: string) {
    const response = await fetch(`${baseUrl}/api/analyze-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Video analysis failed');
    }
    
    return await response.json();
  }

  // 处理字幕生成（包含完整的提交和轮询流程）
  private async handleSubtitleSubmit(data: any, baseUrl: string) {
    // 创建 FormData 对象
    const formData = new FormData();
    
    // 添加音频文件
    if (data.audioFile) {
      formData.append('audio', data.audioFile);
    }
    
    // 添加其他参数
    Object.keys(data).forEach(key => {
      if (key !== 'audioFile') {
        formData.append(key, data[key]);
      }
    });

    // 第一步：提交音频处理任务
    const submitResponse = await fetch(`${baseUrl}/api/subtitle/submit`, {
      method: 'POST',
      body: formData,
    });

    const submitData = await submitResponse.json();

    if (!submitResponse.ok) {
      throw new Error(submitData.error || '提交字幕任务失败');
    }

    const taskId = submitData.taskId;

    // 第二步：轮询处理结果
    let attempts = 0;
    const maxAttempts = 60; // 最多等待5分钟
    
    const pollResults = async (): Promise<any> => {
      const queryResponse = await fetch(`${baseUrl}/api/subtitle/query?taskId=${taskId}&blocking=1`);
      const queryData = await queryResponse.json();

      if (!queryResponse.ok) {
        throw new Error(queryData.error || '查询字幕结果失败');
      }

      if (queryData.status === 'completed') {
        return {
          taskId: queryData.taskId,
          duration: queryData.duration,
          utterances: queryData.utterances,
        };
      } else if (queryData.status === 'processing') {
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error('字幕处理超时，请重试');
        }
        // 等待5秒再轮询
        await new Promise(resolve => setTimeout(resolve, 5000));
        return await pollResults();
      } else {
        throw new Error(queryData.error || '字幕处理失败');
      }
    };

    // 等待2秒后开始轮询
    await new Promise(resolve => setTimeout(resolve, 2000));
    return await pollResults();
  }

  // 处理视频生成
  private async handleGenerateVideo(data: any, baseUrl: string) {
    const response = await fetch(`${baseUrl}/api/generate-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Video generation failed');
    }
    
    return await response.json();
  }

  // 处理火山方舟图片生成
  private async handleVolcengineImage(data: any, baseUrl: string) {
    const response = await fetch(`${baseUrl}/api/volcengine-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Volcengine image generation failed');
    }
    
    return await response.json();
  }

  // 处理火山方舟视频生成
  private async handleVolcengineVideo(data: any, baseUrl: string) {
    const response = await fetch(`${baseUrl}/api/volcengine-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Volcengine video generation failed');
    }
    
    return await response.json();
  }

  // 处理千帆视频生成
  private async handleQianfanVideo(data: any, baseUrl: string) {
    const response = await fetch(`${baseUrl}/api/qianfan-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Qianfan video generation failed');
    }
    
    return await response.json();
  }

  // 处理语音合成 - 使用 tRPC
  private async handleSpeechSynthesize(data: any) {
    // 这里需要调用 tRPC 或直接调用语音合成 API
    // 暂时返回模拟数据，实际实现需要根据你的 tRPC 设置调整
    return { success: true, message: 'Speech synthesis queued' };
  }

  // 获取队列状态
  getQueueStatus(userId?: string): QueueStatus {
    const userPosition = userId ? 
      this.queue.findIndex(item => item.userId === userId) + 1 : 0;
    
    const avgProcessingTime = this.processingTimes.length > 0 
      ? this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length 
      : 30000; // 默认30秒

    const estimatedWaitTime = userPosition > 0 
      ? Math.round((userPosition * avgProcessingTime) / this.maxConcurrent)
      : 0;

    return {
      position: userPosition,
      estimatedWaitTime,
      totalInQueue: this.queue.length,
      currentlyProcessing: this.processing.size
    };
  }

  // 获取队列项目状态
  getQueueItem(itemId: string): QueueItem | null {
    // 首先检查是否在等待队列中
    const queuedItem = this.queue.find(item => item.id === itemId);
    if (queuedItem) return queuedItem;
    
    // 然后检查是否正在处理中
    const processingItem = this.processingItems.get(itemId);
    if (processingItem) return processingItem;
    
    // 最后检查是否已完成
    return this.completed.get(itemId) || null;
  }

  // 记录处理时间
  private recordProcessingTime(time: number) {
    this.processingTimes.push(time);
    if (this.processingTimes.length > this.maxProcessingHistory) {
      this.processingTimes.shift();
    }
  }

  // 清理完成的队列项目
  private cleanupCompleted() {
    if (this.completed.size > this.maxCompletedItems) {
      const items = Array.from(this.completed.entries());
      // 保留最新的项目
      items.sort((a, b) => b[1].timestamp - a[1].timestamp);
      const toKeep = items.slice(0, this.maxCompletedItems);
      this.completed.clear();
      toKeep.forEach(([id, item]) => this.completed.set(id, item));
    }
  }

  // 清理过期的队列项目
  cleanup() {
    const cutoffTime = Date.now() - (10 * 60 * 1000); // 10分钟前
    this.queue = this.queue.filter(item => 
      item.timestamp > cutoffTime || item.status === 'processing'
    );
    
    // 清理过期的完成项目
    const completedItems = Array.from(this.completed.entries());
    completedItems.forEach(([id, item]) => {
      if (item.timestamp < cutoffTime) {
        this.completed.delete(id);
      }
    });
  }
}

// 全局队列管理器实例
export const queueManager = new QueueManager(2); // 最多同时处理2个请求

// 定期清理队列
setInterval(() => {
  queueManager.cleanup();
}, 5 * 60 * 1000); // 每5分钟清理一次
