'use client';

import { useState } from 'react';
import { Button } from '~/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/Card';
import { Input } from '~/components/ui/Input';
import { useVideoGeneration } from '~/hooks/useQueue';

export function VideoGenerator() {
  const { loading, error, result: queueResult, progress, submitToQueue, clearResult } = useVideoGeneration();
  const [prompt, setPrompt] = useState('');
  const [provider, setProvider] = useState<'veo' | 'volcengine' | 'qianfan'>('veo');
  const [model, setModel] = useState<string>('veo-3.0-fast-generate-preview');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [personGeneration, setPersonGeneration] = useState<'allow_all' | 'allow_adult' | 'dont_allow'>('allow_all');
  
  // 从排队结果中获取视频信息
  const videoUri = queueResult?.videoUri || null;
  const videoFile = queueResult?.videoFile || null;
  const localVideoPath = queueResult?.localVideoPath || null;
  
  // Rate limiting states
  const [lastRequestTime, setLastRequestTime] = useState<number>(0);
  
  // New states for image-to-video functionality
  const [generationMode, setGenerationMode] = useState<'text-to-video' | 'image-to-video'>('text-to-video');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Volcengine specific states
  const [volcengineConfig, setVolcengineConfig] = useState({
    resolution: '720p',
    ratio: '16:9',
    duration: 5,
    framespersecond: 24,
    watermark: false,
    seed: -1,
    camerafixed: false,
    return_last_frame: false
  });
  
  // Qianfan specific states
  const [qianfanDuration, setQianfanDuration] = useState<5 | 10>(5);
  
  // Get API key from localStorage
  const getApiKey = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gemini_api_key');
    }
    return null;
  };

  // Handle image file selection
  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        return; // Let the hook handle error display
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        return; // Let the hook handle error display
      }
      
      setSelectedImage(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          setImagePreview(result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Remove selected image
  const removeSelectedImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    // Reset file input
    const fileInput = document.getElementById('image-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  // Convert image to base64
  const imageToBase64 = (file: File): Promise<{ imageBytes: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix to get just the base64 data
        const splitResult = result.split(',');
        const base64Data = splitResult.length > 1 ? splitResult[1] : splitResult[0];
        if (!base64Data) {
          reject(new Error('Failed to convert image to base64'));
          return;
        }
        resolve({
          imageBytes: base64Data,
          mimeType: file.type
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      return; // Hook will handle validation
    }

    // Validate image requirement for image-to-video mode
    if (generationMode === 'image-to-video' && !selectedImage) {
      return; // Hook will handle validation
    }

    // Rate limiting check for Qianfan
    if (provider === 'qianfan') {
      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTime;
      const minInterval = 60000; // 1 minute minimum between requests
      
      if (timeSinceLastRequest < minInterval && lastRequestTime > 0) {
        return; // Hook will handle rate limiting
      }
      
      setLastRequestTime(now);
    }

    try {
      // 准备请求数据
      let requestData: any;
      
      if (provider === 'volcengine') {
        requestData = await prepareVolcengineData();
      } else if (provider === 'qianfan') {
        requestData = await prepareQianfanData();
      } else {
        requestData = await prepareVeoData();
      }

      // 使用 hook 提交到排队系统
      const endpointMap = {
        'veo': 'generate-video',
        'volcengine': 'volcengine-video',
        'qianfan': 'qianfan-video'
      };
      
      await submitToQueue(endpointMap[provider], requestData);
    } catch (err) {
      console.error('Error preparing video generation:', err);
    }
  };

  const prepareVeoData = async () => {
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

    // Prepare request body
    const requestBody: any = { 
      prompt: prompt.trim(), 
      model,
      config,
      apiKey
    };

    // Add image data if in image-to-video mode
    if (generationMode === 'image-to-video' && selectedImage) {
      const imageData = await imageToBase64(selectedImage);
      requestBody.image = imageData;
    }

    return requestBody;
  };

  const prepareVolcengineData = async () => {
    // Prepare request body for Volcengine
    const requestBody: any = { 
      prompt: prompt.trim(), 
      model,
      config: {
        ...volcengineConfig,
        ratio: aspectRatio
      }
    };

    // Add image data if in image-to-video mode
    const images: any[] = [];
    if (generationMode === 'image-to-video' && selectedImage) {
      const imageData = await imageToBase64(selectedImage);
      images.push({
        imageBytes: imageData.imageBytes,
        mimeType: imageData.mimeType,
        role: 'first_frame' // Default role for single image
      });
      requestBody.images = images;
    }

    return requestBody;
  };

  const prepareQianfanData = async () => {
    // Prepare request body for Qianfan
    const requestBody: any = { 
      prompt: prompt.trim(), 
      model,
      config: {
        duration: qianfanDuration // Use user-selected duration
      }
    };

    // Add image data if in image-to-video mode
    const images: any[] = [];
    if (generationMode === 'image-to-video' && selectedImage) {
      const imageData = await imageToBase64(selectedImage);
      images.push({
        imageBytes: imageData.imageBytes,
        mimeType: imageData.mimeType
      });
      requestBody.images = images;
    }

    return requestBody;
  };

  const downloadVideo = async () => {
    if (!videoUri) {
      return;
    }

    try {
      // Handle different providers with different download strategies
      if (provider === 'qianfan' || provider === 'volcengine') {
        // For Qianfan and Volcengine: Direct download from video URL
        try {
          const response = await fetch(videoUri);
          if (!response.ok) {
            throw new Error(`无法获取视频文件: ${response.status}`);
          }
          
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${provider}-video-${Date.now()}.mp4`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          
          return;
        } catch (directDownloadError) {
          console.warn('Direct download failed, trying API method:', directDownloadError);
          // Fall back to API download method
        }
      }
      
      // Use unified download API for providers that support it
      const requestBody: any = {
        provider
      };

      if (provider === 'volcengine' || provider === 'qianfan') {
        // For Volcengine and Qianfan videos, pass the video URL
        requestBody.videoUrl = videoUri;
      } else {
        // For Veo videos, pass the video file object and local path
        if (!videoFile) {
          return;
        }
        
        const apiKey = getApiKey();
        requestBody.videoFile = videoFile;
        requestBody.localVideoPath = localVideoPath;
        requestBody.apiKey = apiKey;
      }

      const response = await fetch('/api/download-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        console.warn('Download API failed');
        return;
      }

      // Check if response is a video file or JSON
      const contentType = response.headers.get('Content-Type');
      
      if (contentType?.includes('video')) {
        // Direct video download - this will trigger browser download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${provider}-video-${Date.now()}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        // JSON response - fallback method
        const data = await response.json();
        if (data.downloadUrl) {
          // Create a hidden link to trigger download
          const link = document.createElement('a');
          link.href = data.downloadUrl;
          link.download = `${provider}-video-${Date.now()}.mp4`;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-gray-900">
          视频生成
        </CardTitle>
        <CardDescription>
          使用 Google Veo AI、火山方舟或百度千帆根据文本描述或图片+文本生成高质量视频 {loading && '(使用排队系统)'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 排队进度显示 */}
        {progress && (
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
            <p className="text-sm text-blue-600">{progress}</p>
          </div>
        )}

        {/* Provider Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            AI 服务商
          </label>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant={provider === 'veo' ? "primary" : "secondary"}
              onClick={() => {
                setProvider('veo');
                setModel('veo-3.0-fast-generate-preview');
              }}
              size="sm"
            >
              🎬 Google Veo
            </Button>
            <Button
              variant={provider === 'volcengine' ? "primary" : "secondary"}
              onClick={() => {
                setProvider('volcengine');
                setModel('doubao-seedance-1-0-pro-250528');
              }}
              size="sm"
            >
              🌋 火山方舟
            </Button>
            <Button
              variant={provider === 'qianfan' ? "primary" : "secondary"}
              onClick={() => {
                setProvider('qianfan');
                setModel('musesteamer-2.0-turbo-i2v-audio');
                // Automatically switch to image-to-video mode for Qianfan
                setGenerationMode('image-to-video');
              }}
              size="sm"
            >
              🎯 百度千帆
            </Button>
          </div>
          <p className="text-xs text-gray-600">
            {provider === 'veo' 
              ? '💡 Google Veo：支持音频生成，8秒高质量视频'
              : provider === 'volcengine'
              ? '💡 火山方舟：支持多种模型，文生视频和图生视频能力强大'
              : '💡 百度千帆：MuseSteamer系列，专业音视频生成，支持特效模式'
            }
          </p>
        </div>

        {/* Generation Mode Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            生成模式
          </label>
          {provider === 'qianfan' ? (
            // For Qianfan (Baidu), only show image-to-video mode
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
              <div className="flex items-center gap-2">
                <span className="text-blue-600">🖼️ 图片+文本生成视频</span>
                <span className="text-xs text-blue-500 bg-blue-100 px-2 py-1 rounded">仅支持此模式</span>
              </div>
              <p className="text-xs text-blue-600 mt-1">
                💡 百度MuseSteamer专注于图片+文本生成视频，请上传一张图片作为视频的起始帧
              </p>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                variant={generationMode === 'text-to-video' ? "primary" : "secondary"}
                onClick={() => {
                  setGenerationMode('text-to-video');
                  // Clear image selection when switching to text-to-video
                  if (selectedImage) {
                    removeSelectedImage();
                  }
                }}
                size="sm"
                className="flex-1"
              >
                📝 文本生成视频
              </Button>
              <Button
                variant={generationMode === 'image-to-video' ? "primary" : "secondary"}
                onClick={() => setGenerationMode('image-to-video')}
                size="sm"
                className="flex-1"
                disabled={provider === 'veo' && model === 'veo-3.0-fast-generate-preview'}
              >
                🖼️ 图片+文本生成视频
              </Button>
            </div>
          )}
          {provider !== 'qianfan' && generationMode === 'image-to-video' && (
            <p className="text-xs text-blue-600">
              💡 图片+文本模式：上传一张图片作为视频的起始帧，AI将基于图片和文本描述生成动画
            </p>
          )}
          {provider === 'veo' && model === 'veo-3.0-fast-generate-preview' && (
            <p className="text-xs text-orange-600">
              ⚠️ Veo 3 Fast 目前暂不支持图片生成视频，请选择 Veo 2 或火山方舟模型
            </p>
          )}
        </div>

        {/* Image Upload Section - Only show when image-to-video mode is selected */}
        {generationMode === 'image-to-video' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              上传图片 *
            </label>
            {!selectedImage ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <label
                  htmlFor="image-upload"
                  className="cursor-pointer flex flex-col items-center space-y-2"
                >
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">点击上传图片</p>
                    <p className="text-xs text-gray-400">支持 JPG, PNG, GIF 格式，最大 10MB</p>
                  </div>
                </label>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative border border-gray-200 rounded-lg p-2 bg-gray-50">
                  <img
                    src={imagePreview!}
                    alt="Preview"
                    className="w-full h-32 object-cover rounded"
                  />
                  <button
                    onClick={removeSelectedImage}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                  >
                    ×
                  </button>
                </div>
                <p className="text-xs text-gray-600">
                  已选择: {selectedImage.name} ({(selectedImage.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              </div>
            )}
          </div>
        )}

        {/* Model Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            选择模型
          </label>
          <div className="space-y-2">
            {(provider === 'veo' ? [
              { id: 'veo-3.0-fast-generate-preview', name: 'Veo 3 Fast (推荐)', desc: '最新模型，8秒高质量视频，包含音频，快速生成' },
              { id: 'veo-2.0-generate-001', name: 'Veo 2', desc: '稳定模型，5-8秒视频，静音，更多配置选项' },
            ] : provider === 'volcengine' ? [
              { id: 'doubao-seedance-1-0-pro-250528', name: 'Seedance Pro (推荐)', desc: '豆包视频生成专业版，高质量视频生成' },
              { id: 'doubao-seedance-1-0-lite-t2v-250428', name: 'Seedance Lite T2V', desc: '文本生成视频轻量版，快速生成' },
              { id: 'doubao-seedance-1-0-lite-i2v-250428', name: 'Seedance Lite I2V', desc: '图片+文本生成视频，支持首帧/尾帧/参考图' },
            ] : [
              { id: 'musesteamer-2.0-turbo-i2v-audio', name: 'MuseSteamer Turbo Audio (推荐)', desc: '支持音频生成的图生视频模型，5-10秒高质量视频' },
              { id: 'musesteamer-2.0-turbo-i2v', name: 'MuseSteamer Turbo', desc: '快速图生视频模型，5秒高质量视频生成' },
              { id: 'musesteamer-2.0-pro-i2v', name: 'MuseSteamer Pro', desc: '专业图生视频模型，更高质量和细节' },
              { id: 'musesteamer-2.0-lite-i2v', name: 'MuseSteamer Lite', desc: '轻量级图生视频模型，快速生成' },
              { id: 'musesteamer-2.0-turbo-i2v-effect', name: 'MuseSteamer Effect', desc: '特效模式，支持特殊视频效果生成' },
            ]).map((modelOption) => (
              <div
                key={modelOption.id}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                  model === modelOption.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
                onClick={() => setModel(modelOption.id)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{modelOption.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {modelOption.desc}
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
          {model === 'musesteamer-2.0-turbo-i2v-audio' && (
            <p className="text-xs text-blue-600">
              🎵 MuseSteamer Audio 支持音频生成！可以在描述中加入对话内容、背景音乐描述和环境音效，例如："人物说话：'你好'"、"背景播放轻松的音乐"
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

          {/* Duration Selection - only for Qianfan */}
          {provider === 'qianfan' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                视频时长
              </label>
              <div className="flex gap-2">
                <Button
                  variant={qianfanDuration === 5 ? "primary" : "secondary"}
                  onClick={() => setQianfanDuration(5)}
                  size="sm"
                  className="flex-1"
                >
                  5秒
                </Button>
                {model === 'musesteamer-2.0-turbo-i2v-audio' && (
                  <Button
                    variant={qianfanDuration === 10 ? "primary" : "secondary"}
                    onClick={() => setQianfanDuration(10)}
                    size="sm"
                    className="flex-1"
                  >
                    10秒
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-600">
                {model === 'musesteamer-2.0-turbo-i2v-audio' 
                  ? '💡 MuseSteamer Turbo Audio 支持5秒和10秒视频生成'
                  : '💡 此模型仅支持5秒视频生成'
                }
              </p>
            </div>
          )}

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
          {loading ? '生成中...' : '生成视频'}
        </Button>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {videoUri && (
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">生成结果</label>
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <video
                src={videoUri}
                controls
                className="w-full max-h-96 rounded-lg"
                preload="metadata"
              >
                您的浏览器不支持视频播放。
              </video>
            </div>
            <Button
              onClick={downloadVideo}
              variant="secondary"
              size="sm"
              className="w-full"
            >
              下载视频
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
