'use client';

import { useState, useRef } from 'react';
import { Button } from '~/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/Card';
import { Input } from '~/components/ui/Input';

export function ImageAnalyzer() {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analysisMode, setAnalysisMode] = useState<'upload' | 'url'>('upload');
  const [analysisType, setAnalysisType] = useState<'general' | 'detection' | 'segmentation'>('general');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file size (20MB limit)
      if (file.size > 20 * 1024 * 1024) {
        setError('图片文件大小不能超过 20MB');
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        setError('请选择有效的图片文件');
        return;
      }
      
      setImageMimeType(file.type);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setImagePreview(base64);
        // Remove the data:image/...;base64, prefix
        const base64Data = base64.split(',')[1];
        setUploadedImage(base64Data || null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUrlLoad = () => {
    if (!imageUrl.trim()) {
      setError('请输入图片链接');
      return;
    }
    
    setImagePreview(imageUrl);
    setUploadedImage(null);
  };

  const handleAnalyze = async () => {
    if (!prompt.trim()) {
      setError('请输入分析指令');
      return;
    }

    if (analysisMode === 'upload' && !uploadedImage) {
      setError('请先上传图片文件');
      return;
    }

    if (analysisMode === 'url' && !imageUrl.trim()) {
      setError('请输入图片链接');
      return;
    }

    setLoading(true);
    setError('');
    setResult('');

    try {
      const requestBody: any = { 
        prompt,
        analysisType
      };
      
      if (analysisMode === 'upload' && uploadedImage) {
        requestBody.imageData = uploadedImage;
      } else if (analysisMode === 'url') {
        requestBody.imageUrl = imageUrl;
      }

      const response = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '分析图片时出错');
      }

      setResult(data.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析图片时出错');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setUploadedImage(null);
    setImageUrl('');
    setImagePreview(null);
    setResult('');
    setError('');
    setPrompt('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getPresetPrompts = () => {
    const basePrompts = [
      '请描述这张图片的内容',
      '分析图片中的主要元素和构图',
      '识别图片中的文字内容',
      '描述图片的色彩和风格',
      '分析图片的情感表达'
    ];

    const detectionPrompts = [
      '检测图片中的所有物体',
      '识别图片中的人物和动物',
      '找出图片中的交通工具',
      '检测图片中的建筑物和地标',
      '识别图片中的食物和饮品'
    ];

    const segmentationPrompts = [
      '分割图片中的主要对象',
      '分离前景和背景',
      '分割图片中的人物轮廓',
      '分离图片中的不同材质区域',
      '提取图片中的特定物体轮廓'
    ];

    switch (analysisType) {
      case 'detection':
        return detectionPrompts;
      case 'segmentation':
        return segmentationPrompts;
      default:
        return basePrompts;
    }
  };

  const formatResult = (text: string) => {
    if (analysisType === 'detection' || analysisType === 'segmentation') {
      try {
        const parsed = JSON.parse(text);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return text;
      }
    }
    return text;
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-gray-900">图片分析</CardTitle>
        <CardDescription>
          使用 Gemini AI 分析图片内容，支持图片描述、物体检测和语义分割
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Analysis Type Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">分析类型</label>
          <div className="flex gap-2">
            <Button
              variant={analysisType === 'general' ? "primary" : "secondary"}
              onClick={() => setAnalysisType('general')}
              size="sm"
            >
              📝 通用分析
            </Button>
            <Button
              variant={analysisType === 'detection' ? "primary" : "secondary"}
              onClick={() => setAnalysisType('detection')}
              size="sm"
            >
              🎯 物体检测
            </Button>
            <Button
              variant={analysisType === 'segmentation' ? "primary" : "secondary"}
              onClick={() => setAnalysisType('segmentation')}
              size="sm"
            >
              ✂️ 语义分割
            </Button>
          </div>
        </div>

        {/* Input Mode Selection */}
        <div className="flex gap-2">
          <Button
            variant={analysisMode === 'upload' ? "primary" : "secondary"}
            onClick={() => {
              setAnalysisMode('upload');
              setImageUrl('');
              setImagePreview(null);
            }}
            size="sm"
          >
            📁 上传图片
          </Button>
          <Button
            variant={analysisMode === 'url' ? "primary" : "secondary"}
            onClick={() => {
              setAnalysisMode('url');
              resetForm();
            }}
            size="sm"
          >
            🔗 图片链接
          </Button>
        </div>

        {/* Upload Mode */}
        {analysisMode === 'upload' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              上传图片文件 (最大 20MB)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
        )}

        {/* URL Mode */}
        {analysisMode === 'url' && (
          <div className="space-y-2">
            <label htmlFor="image-url" className="text-sm font-medium text-gray-700">
              图片链接
            </label>
            <div className="flex gap-2">
              <Input
                id="image-url"
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleUrlLoad} variant="secondary" size="sm">
                加载
              </Button>
            </div>
          </div>
        )}

        {/* Image Preview */}
        {imagePreview && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">图片预览</label>
            <div className="border rounded-lg p-4 bg-gray-50">
              <img 
                src={imagePreview} 
                alt="Preview" 
                className="max-w-full max-h-96 mx-auto rounded-lg shadow-md object-contain"
              />
            </div>
          </div>
        )}

        {/* Analysis Prompt */}
        <div className="space-y-2">
          <label htmlFor="analysis-prompt" className="text-sm font-medium text-gray-700">
            分析指令
          </label>
          <Input
            id="analysis-prompt"
            placeholder="描述您想要对图片进行的分析..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleAnalyze()}
          />
        </div>

        {/* Preset Prompts */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">常用分析模板</label>
          <div className="flex flex-wrap gap-2">
            {getPresetPrompts().map((preset, index) => (
              <Button
                key={index}
                variant="ghost"
                size="sm"
                onClick={() => setPrompt(preset)}
                className="text-xs"
              >
                {preset}
              </Button>
            ))}
          </div>
        </div>
        
        {/* Analyze Button */}
        <Button 
          onClick={handleAnalyze} 
          loading={loading}
          disabled={
            loading || 
            !prompt.trim() || 
            !imagePreview ||
            (analysisMode === 'upload' && !uploadedImage) ||
            (analysisMode === 'url' && !imageUrl.trim())
          }
          variant="primary"
          className="w-full"
        >
          {loading ? '分析中...' : '开始分析'}
        </Button>

        {/* Error Display */}
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Results Display */}
        {result && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">分析结果</label>
            <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
              <pre className="text-sm text-gray-900 whitespace-pre-wrap font-mono">
                {formatResult(result)}
              </pre>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigator.clipboard.writeText(result)}
              >
                复制结果
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={resetForm}
              >
                重新分析
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
