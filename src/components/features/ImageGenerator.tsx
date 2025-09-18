'use client';

import { useState, useRef } from 'react';
import { Button } from '~/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/Card';
import { Input } from '~/components/ui/Input';
import { useImageGeneration } from '~/hooks/useQueue';

interface GeneratedImage {
  url?: string;
  b64_json?: string;
  size?: string;
}

interface GenerationResult {
  model: string;
  created: number;
  images: GeneratedImage[];
  usage: {
    generated_images: number;
    output_tokens: number;
    total_tokens: number;
  };
  errors?: Array<{
    error: {
      code: string;
      message: string;
    };
  }>;
}

export function ImageGenerator() {
  const { loading, error, result: queueResult, progress, submitToQueue, clearResult } = useImageGeneration();
  const [prompt, setPrompt] = useState('');
  const [provider, setProvider] = useState<'gemini' | 'volcengine'>('volcengine');
  const [model, setModel] = useState('doubao-seedream-4-0-250828');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [sequentialMode, setSequentialMode] = useState<'disabled' | 'auto'>('disabled');
  const [maxImages, setMaxImages] = useState(3);
  const [size, setSize] = useState('2K');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 从排队结果中获取图片信息
  const result = queueResult?.images || queueResult?.data?.images || [];

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const fileArray = Array.from(files);
    const uploadPromises = fileArray.map((file) => {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = e.target?.result as string;
          if (!base64) {
            reject(new Error('读取文件失败'));
            return;
          }
          resolve(base64);
        };
        reader.onerror = () => reject(new Error('读取文件失败'));
        reader.readAsDataURL(file);
      });
    });

    Promise.all(uploadPromises)
      .then((base64Images) => {
        setUploadedImages(base64Images);
      })
      .catch((err) => {
        console.error('Error processing images:', err);
      });
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      return; // Hook will handle validation
    }

    try {
      // 准备请求数据
      let requestData: any;
      
      if (provider === 'volcengine') {
        requestData = {
          model,
          prompt,
          size,
          sequential_image_generation: sequentialMode,
          response_format: 'b64_json'
        };

        if (uploadedImages.length > 0) {
          requestData.image = uploadedImages.length === 1 ? uploadedImages[0] : uploadedImages;
        }

        if (sequentialMode === 'auto') {
          requestData.sequential_image_generation_options = {
            max_images: maxImages
          };
        }

        // 使用 hook 提交到排队系统
        await submitToQueue('volcengine-image', requestData);
      } else {
        // Gemini provider
        const apiKey = localStorage.getItem('gemini_api_key');
        if (!apiKey) {
          return; // Hook will handle error display
        }

        if (uploadedImages.length > 0) {
          requestData = { 
            prompt, 
            imageData: uploadedImages[0]?.split(',')[1], 
            apiKey 
          };
          await submitToQueue('edit-image', requestData);
        } else {
          requestData = { prompt, apiKey };
          await submitToQueue('generate-image', requestData);
        }
      }
    } catch (err) {
      console.error('Error preparing image generation:', err);
    }
  };

  const resetForm = () => {
    setUploadedImages([]);
    clearResult(); // 使用 hook 的 clearResult 方法
    setPrompt('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadImage = (imageData: string, index: number) => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${imageData}`;
    link.download = `generated-image-${index + 1}.png`;
    link.click();
  };

  const getGenerationModeDescription = () => {
    if (provider === 'gemini') {
      return uploadedImages.length > 0 ? '图片编辑模式 (Gemini)' : '文本生成图片 (Gemini)';
    }
    
    if (uploadedImages.length > 1) {
      return sequentialMode === 'auto' 
        ? `多图生组图 (${uploadedImages.length}张参考图 → 最多${maxImages}张结果)`
        : `多图融合 (${uploadedImages.length}张参考图 → 1张结果)`;
    } else if (uploadedImages.length === 1) {
      return sequentialMode === 'auto' 
        ? `单图生组图 (1张参考图 → 最多${maxImages}张结果)`
        : '图生图 (1张参考图 → 1张结果)';
    } else {
      return sequentialMode === 'auto' 
        ? `文生组图 (最多生成${maxImages}张图片)`
        : '文生图 (生成1张图片)';
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-gray-900">
          AI 图片生成
        </CardTitle>
        <CardDescription>
          {getGenerationModeDescription()} {loading && '(使用排队系统)'}
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
          <label className="text-sm font-medium text-gray-700">AI 模型选择</label>
          <div className="flex gap-2">
            <Button
              variant={provider === 'volcengine' ? "primary" : "secondary"}
              onClick={() => setProvider('volcengine')}
              size="sm"
            >
              Seedream 4.0
            </Button>
            <Button
              variant={provider === 'gemini' ? "primary" : "secondary"}
              onClick={() => setProvider('gemini')}
              size="sm"
            >
              Nano Banana
            </Button>
          </div>
        </div>

        {provider === 'volcengine' && (
          <>
            {/* Sequential Generation Mode */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">生成模式</label>
              <div className="flex gap-2">
                <Button
                  variant={sequentialMode === 'disabled' ? "primary" : "secondary"}
                  onClick={() => setSequentialMode('disabled')}
                  size="sm"
                >
                  单图模式
                </Button>
                <Button
                  variant={sequentialMode === 'auto' ? "primary" : "secondary"}
                  onClick={() => setSequentialMode('auto')}
                  size="sm"
                >
                  组图模式
                </Button>
              </div>
            </div>

            {/* Max Images for Sequential Mode */}
            {sequentialMode === 'auto' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  最大生成图片数量: {maxImages}
                </label>
                <input
                  type="range"
                  min="1"
                  max="15"
                  value={maxImages}
                  onChange={(e) => setMaxImages(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            )}

            {/* Size Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">图片尺寸</label>
              <div className="flex gap-2">
                {['1K', '2K', '4K'].map((sizeOption) => (
                  <Button
                    key={sizeOption}
                    variant={size === sizeOption ? "primary" : "secondary"}
                    onClick={() => setSize(sizeOption)}
                    size="sm"
                  >
                    {sizeOption}
                  </Button>
                ))}
              </div>
            </div>

          </>
        )}

        {/* Image Upload */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            参考图片 ({provider === 'volcengine' ? '最多10张' : '仅支持1张'})
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple={provider === 'volcengine'}
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {uploadedImages.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 mt-2">
              {uploadedImages.map((image, index) => (
                <div key={index} className="relative">
                  <img
                    src={image}
                    alt={`Uploaded ${index + 1}`}
                    className="w-full h-20 object-cover rounded-lg border border-gray-200"
                  />
                  <div className="absolute top-1 left-1 bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium">
                    {index + 1}
                  </div>
                  <button
                    onClick={() => setUploadedImages(prev => prev.filter((_, i) => i !== index))}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Prompt Input */}
        <div className="space-y-2">
          <label htmlFor="image-prompt" className="text-sm font-medium text-gray-700">
            图片描述/生成指令
          </label>
          <Input
            id="image-prompt"
            placeholder={
              provider === 'volcengine' && sequentialMode === 'auto'
                ? "生成3张不同风格的猫咪图片：卡通风格、写实风格、水彩风格"
                : "描述您想要生成的图片..."
            }
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleGenerate()}
          />
          {provider === 'volcengine' && sequentialMode === 'auto' && (
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
              <p className="text-xs text-blue-800 font-medium mb-1">💡 组图模式提示词要求：</p>
              <p className="text-xs text-blue-700 mb-2">要生成多张图片，需要在提示词中明确说明要生成的图片数量和不同的风格/变化。</p>
              <div className="text-xs text-blue-700 space-y-1">
                <p><strong>✅ 有效示例：</strong></p>
                <p>• "生成4张不同季节的风景图：春天樱花、夏天海滩、秋天枫叶、冬天雪景"</p>
                <p>• "创作5张不同风格的猫咪肖像：写实、卡通、水彩、素描、油画"</p>
                <p>• "制作3张不同角度的建筑物图片：正面视角、侧面视角、鸟瞰视角"</p>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button 
            onClick={handleGenerate} 
            loading={loading}
            disabled={loading || !prompt.trim()}
            variant="primary"
            className="flex-1"
          >
            {loading ? '生成中...' : '生成图片'}
          </Button>
          <Button 
            onClick={resetForm}
            variant="secondary"
            disabled={loading}
          >
            重置
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Results Display */}
        {result.length > 0 && (
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">
              生成结果 ({result.length}张图片)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {result.map((image: GeneratedImage, index: number) => (
                <div key={index} className="space-y-2">
                  <div className="border border-gray-200 rounded-lg p-2">
                    <img
                      src={image.url || `data:image/png;base64,${image.b64_json}`}
                      alt={`Generated ${index + 1}`}
                      className="w-full h-auto rounded-lg"
                    />
                    {image.size && (
                      <p className="text-xs text-gray-500 mt-1">尺寸: {image.size}</p>
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => downloadImage(image.b64_json || '', index)}
                    className="w-full"
                  >
                    下载图片 {index + 1}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
