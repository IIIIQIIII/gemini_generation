'use client';

import { useState, useRef } from 'react';
import { Button } from '~/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/Card';
import { Input } from '~/components/ui/Input';
export function VideoAnalyzer() {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analysisMode, setAnalysisMode] = useState<'upload' | 'youtube'>('upload');
  const [uploadedVideo, setUploadedVideo] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file size (20MB limit)
      if (file.size > 20 * 1024 * 1024) {
        setError('视频文件大小不能超过 20MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        // Remove the data:video/mp4;base64, prefix
        const base64Data = base64.split(',')[1];
        setUploadedVideo(base64Data || null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!prompt.trim()) {
      setError('请输入分析指令');
      return;
    }

    if (analysisMode === 'upload' && !uploadedVideo) {
      setError('请先上传视频文件');
      return;
    }

    if (analysisMode === 'youtube' && !youtubeUrl.trim()) {
      setError('请输入YouTube视频链接');
      return;
    }

    setLoading(true);
    setError('');
    setResult('');

    try {
      const requestBody: any = { prompt };
      
      if (analysisMode === 'upload' && uploadedVideo) {
        requestBody.videoData = uploadedVideo;
      } else if (analysisMode === 'youtube') {
        requestBody.youtubeUrl = youtubeUrl;
      }

      const response = await fetch('/api/analyze-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '分析视频时出错');
      }

      setResult(data.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析视频时出错');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setUploadedVideo(null);
    setYoutubeUrl('');
    setResult('');
    setError('');
    setPrompt('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getPresetPrompts = () => [
    '请总结这个视频的主要内容',
    '描述视频中的关键场景和人物',
    '提取视频中的文字信息',
    '分析视频的情感基调',
    '列出视频中提到的重要观点'
  ];

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-gray-900">视频分析</CardTitle>
        <CardDescription>
          使用 Gemini AI 分析视频内容，支持上传视频或分析YouTube视频
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            variant={analysisMode === 'upload' ? "primary" : "secondary"}
            onClick={() => {
              setAnalysisMode('upload');
              resetForm();
            }}
            size="sm"
          >
            上传视频
          </Button>
          <Button
            variant={analysisMode === 'youtube' ? "primary" : "secondary"}
            onClick={() => {
              setAnalysisMode('youtube');
              resetForm();
            }}
            size="sm"
          >
            YouTube链接
          </Button>
        </div>

        {analysisMode === 'upload' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              上传视频文件 (最大 20MB)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {uploadedVideo && (
              <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                <p className="text-sm text-green-600">✓ 视频文件已上传</p>
              </div>
            )}
          </div>
        )}

        {analysisMode === 'youtube' && (
          <div className="space-y-2">
            <label htmlFor="youtube-url" className="text-sm font-medium text-gray-700">
              YouTube视频链接
            </label>
            <Input
              id="youtube-url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
            />
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="analysis-prompt" className="text-sm font-medium text-gray-700">
            分析指令
          </label>
          <Input
            id="analysis-prompt"
            placeholder="描述您想要对视频进行的分析..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleAnalyze()}
          />
        </div>

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
        
        <Button 
          onClick={handleAnalyze} 
          loading={loading}
          disabled={
            loading || 
            !prompt.trim() || 
            (analysisMode === 'upload' && !uploadedVideo) ||
            (analysisMode === 'youtube' && !youtubeUrl.trim())
          }
          variant="primary"
          className="w-full"
        >
          {loading ? '分析中...' : '开始分析'}
        </Button>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">分析结果</label>
            <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
              <p className="text-sm text-gray-900 whitespace-pre-wrap">{result}</p>
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
