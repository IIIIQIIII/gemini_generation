'use client';

import { useState, useEffect } from 'react';
import { Button } from '~/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/Card';
import { Input } from '~/components/ui/Input';

export function VideoGenerator() {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<'veo-3.0-fast-generate-preview' | 'veo-2.0-generate-001'>('veo-3.0-fast-generate-preview');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [personGeneration, setPersonGeneration] = useState<'allow_all' | 'allow_adult' | 'dont_allow'>('allow_all');
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<any>(null);
  const [localVideoPath, setLocalVideoPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [operationName, setOperationName] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Get API key from localStorage
  const getApiKey = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gemini_api_key');
    }
    return null;
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('请输入视频描述');
      return;
    }

    setLoading(true);
    setError('');
    setVideoUri(null);
    setProgress('开始生成视频...');

    try {
      const config: any = {
        aspectRatio,
      };

      if (negativePrompt.trim()) {
        config.negativePrompt = negativePrompt.trim();
      }

      if (model === 'veo-2.0-generate-001' || personGeneration !== 'allow_all') {
        config.personGeneration = personGeneration;
      }

      const apiKey = getApiKey();
      if (!apiKey) {
        throw new Error('请先设置API Key');
      }

      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          prompt: prompt.trim(), 
          model,
          config,
          apiKey
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 408) {
          throw new Error('视频生成超时，这通常需要几分钟时间，请稍后重试');
        }
        throw new Error(data.error || '生成视频时出错');
      }

      if (data.status === 'completed' && data.videoUri) {
        // API now returns local video URL that can be played directly
        setVideoUri(data.videoUri);
        setVideoFile(data.videoFile); // Save the video file object for download
        setLocalVideoPath(data.localVideoPath); // Save local path for download
        setProgress('视频生成完成！');
        setLoading(false);
      } else if (data.status === 'processing' && data.operationName) {
        // Start client-side polling
        setOperationName(data.operationName);
        setProgress(`${data.message} - 正在后台生成中...`);
        startPolling(data.operationName);
      } else {
        throw new Error('未收到有效的视频数据');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成视频时出错');
      setProgress('');
    } finally {
      setLoading(false);
    }
  };

  const downloadVideo = async () => {
    if (!videoFile) {
      setError('视频文件信息丢失，无法下载');
      return;
    }

    try {
      setProgress('正在下载视频到本地...');
      
      // Use our download API endpoint that returns the actual video file
      const response = await fetch('/api/download-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          videoFile,
          localVideoPath 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '下载失败');
      }

      // Check if response is a video file or JSON
      const contentType = response.headers.get('Content-Type');
      
      if (contentType?.includes('video')) {
        // Direct video download - this will trigger browser download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `generated-video-${Date.now()}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        setProgress('视频下载完成！');
        setTimeout(() => setProgress(''), 3000);
      } else {
        // JSON response - fallback method
        const data = await response.json();
        if (data.downloadUrl) {
          // Create a hidden link to trigger download
          const link = document.createElement('a');
          link.href = data.downloadUrl;
          link.download = `generated-video-${Date.now()}.mp4`;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setProgress('视频下载已开始，请检查浏览器下载！');
          setTimeout(() => setProgress(''), 5000);
        } else {
          throw new Error('未收到有效的下载响应');
        }
      }
    } catch (error) {
      console.error('Download failed:', error);
      setError(error instanceof Error ? error.message : '下载视频时出错');
    }
  };

  const copyVideoLink = async () => {
    if (videoUri) {
      try {
        await navigator.clipboard.writeText(videoUri);
        setProgress('视频链接已复制到剪贴板！');
        setTimeout(() => setProgress(''), 3000);
      } catch (error) {
        setError('无法复制链接，请手动复制视频地址');
      }
    }
  };

  const startPolling = (opName: string) => {
    let attempts = 0;
    const maxAttempts = 60; // 10 minutes of polling
    
    const poll = async () => {
      try {
        attempts++;
        setProgress(`视频生成中... (${attempts}/${maxAttempts}) 预计还需要几分钟`);
        
        const apiKey = getApiKey();
        if (!apiKey) {
          setError('API Key丢失，请刷新页面重新设置');
          setLoading(false);
          stopPolling();
          return;
        }
        
        const response = await fetch(`/api/generate-video?operation=${encodeURIComponent(opName)}&apiKey=${encodeURIComponent(apiKey)}`);
        const data = await response.json();
        
        if (response.ok && data.done && data.videoUri) {
          // Video generation completed - API already returns local URL
          setVideoUri(data.videoUri); // This is now a local URL
          setVideoFile(data.videoFile); // Video file object for download
          setLocalVideoPath(data.localVideoPath); // Local path for download
          setProgress('视频生成完成！');
          setLoading(false);
          stopPolling();
        } else if (attempts >= maxAttempts) {
          // Max attempts reached
          setError('视频生成超时，请稍后重试或尝试简化提示词');
          setLoading(false);
          stopPolling();
        } else {
          // Continue polling
          const interval = setTimeout(poll, 15000); // Poll every 15 seconds
          setPollingInterval(interval);
        }
      } catch (error) {
        console.error('Polling error:', error);
        if (attempts >= 3) {
          setError('无法获取视频生成状态，请刷新页面重试');
          setLoading(false);
          stopPolling();
        } else {
          // Retry
          const interval = setTimeout(poll, 15000);
          setPollingInterval(interval);
        }
      }
    };
    
    // Start polling
    const interval = setTimeout(poll, 10000); // First check after 10 seconds
    setPollingInterval(interval);
  };

  const stopPolling = () => {
    if (pollingInterval) {
      clearTimeout(pollingInterval);
      setPollingInterval(null);
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  const getModelDescription = (modelId: string) => {
    switch (modelId) {
      case 'veo-3.0-fast-generate-preview':
        return 'Veo 3 Fast - 最新模型，8秒高质量视频，包含音频，快速生成';
      case 'veo-2.0-generate-001':
        return 'Veo 2 - 稳定模型，5-8秒视频，静音，更多配置选项';
      default:
        return '';
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-gray-900">
          视频生成
        </CardTitle>
        <CardDescription>
          使用 Google Veo AI 根据文本描述生成高质量视频
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Model Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            选择模型
          </label>
          <div className="space-y-2">
            {[
              { id: 'veo-3.0-fast-generate-preview', name: 'Veo 3 Fast (推荐)' },
              { id: 'veo-2.0-generate-001', name: 'Veo 2' },
            ].map((modelOption) => (
              <div
                key={modelOption.id}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                  model === modelOption.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
                onClick={() => setModel(modelOption.id as any)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{modelOption.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {getModelDescription(modelOption.id)}
                    </p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 mt-1 ${
                    model === modelOption.id 
                      ? 'border-blue-500 bg-blue-500' 
                      : 'border-gray-300'
                  }`}>
                    {model === modelOption.id && (
                      <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Video Prompt */}
        <div className="space-y-2">
          <label htmlFor="video-prompt" className="text-sm font-medium text-gray-700">
            视频描述 *
          </label>
          <textarea
            id="video-prompt"
            placeholder="描述您想要生成的视频场景，包括主体、动作、风格等。例如：一只可爱的小猫在阳光下的花园里追蝴蝶，慢镜头，温馨风格"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={4}
          />
          {model === 'veo-3.0-fast-generate-preview' && (
            <p className="text-xs text-blue-600">
              💡 Veo 3 支持音频提示！可以在描述中加入对话（使用引号）、音效描述和环境音描述
            </p>
          )}
        </div>

        {/* Configuration Options */}
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900">高级设置</h4>
          
          {/* Aspect Ratio */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              宽高比
            </label>
            <div className="flex gap-2">
              <Button
                variant={aspectRatio === '16:9' ? "primary" : "secondary"}
                onClick={() => setAspectRatio('16:9')}
                size="sm"
              >
                16:9 (横屏)
              </Button>
              {model === 'veo-2.0-generate-001' && (
                <Button
                  variant={aspectRatio === '9:16' ? "primary" : "secondary"}
                  onClick={() => setAspectRatio('9:16')}
                  size="sm"
                >
                  9:16 (竖屏)
                </Button>
              )}
            </div>
          </div>

          {/* Negative Prompt */}
          <div className="space-y-2">
            <label htmlFor="negative-prompt" className="text-sm font-medium text-gray-700">
              负面提示词（可选）
            </label>
            <Input
              id="negative-prompt"
              placeholder="描述您不希望在视频中出现的内容，如：低质量、模糊、暗色调"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
            />
          </div>

          {/* Person Generation - only for Veo 2 or when specified */}
          {(model === 'veo-2.0-generate-001' || personGeneration !== 'allow_all') && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                人物生成设置
              </label>
              <select
                value={personGeneration}
                onChange={(e) => setPersonGeneration(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="allow_all">允许所有人物</option>
                <option value="allow_adult">仅允许成人</option>
                <option value="dont_allow">不允许人物</option>
              </select>
            </div>
          )}
        </div>
        
        <Button 
          onClick={handleGenerate} 
          loading={loading}
          disabled={loading || !prompt.trim()}
          variant="primary"
          className="w-full"
        >
          {loading ? '生成中...' : `使用 ${model === 'veo-3.0-fast-generate-preview' ? 'Veo 3 Fast' : 'Veo 2'} 生成视频`}
        </Button>

        {progress && (
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
            <p className="text-sm text-blue-600">{progress}</p>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {videoUri && (
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">生成结果</label>
            <div className="border border-gray-200 rounded-lg p-2 bg-black">
              <video
                src={videoUri}
                controls
                className="w-full h-auto rounded-lg"
                style={{ maxHeight: '400px' }}
                onError={(e) => {
                  console.log('Video playback error, trying alternatives...');
                  // If proxy fails, show a message with alternatives
                  const videoElement = e.target as HTMLVideoElement;
                  videoElement.style.display = 'none';
                  
                  // Create error message
                  const errorDiv = document.createElement('div');
                  errorDiv.className = 'flex flex-col items-center justify-center h-48 text-white';
                  errorDiv.innerHTML = `
                    <div class="text-center space-y-2">
                      <p class="text-sm">⚠️ 视频播放遇到问题</p>
                      <p class="text-xs opacity-75">可能是网络连接问题</p>
                    </div>
                  `;
                  
                  if (videoElement.parentNode) {
                    videoElement.parentNode.appendChild(errorDiv);
                  }
                }}
              >
                您的浏览器不支持视频播放。
              </video>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={downloadVideo}
                className="flex-1"
              >
                下载视频
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  // Open the app's local video URL in new window
                  if (videoUri) {
                    window.open(videoUri, '_blank');
                  } else {
                    setError('视频链接不可用');
                  }
                }}
                className="flex-1"
              >
                在新窗口打开
              </Button>
            </div>
            <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-yellow-800">
                💡 如果视频无法播放，请点击"下载视频"或"在新窗口打开"。视频在服务器上保存2天。
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
