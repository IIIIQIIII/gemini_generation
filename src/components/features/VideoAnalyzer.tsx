'use client';

import { useState, useRef } from 'react';
import { Button } from '~/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/Card';
import { Input } from '~/components/ui/Input';
import { useAuth } from '~/components/layout/Header';

export function VideoAnalyzer() {
  const { useVertexAI, setUseVertexAI, authMode, setAuthMode } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analysisMode, setAnalysisMode] = useState<'upload' | 'youtube'>('upload');
  const [uploadedVideo, setUploadedVideo] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
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

    // For API Key mode, check if API key is available
    if (!useVertexAI) {
      const apiKey = localStorage.getItem('gemini_api_key');
      if (!apiKey) {
        setError('请先设置API Key，或选择Vertex AI模式');
        return;
      }
    }

    setLoading(true);
    setError('');
    setResult('');
    setAuthMode(''); // Clear previous mode

    try {
      const requestBody: any = { 
        prompt, 
        useVertexAI: useVertexAI 
      };
      
      if (analysisMode === 'upload' && uploadedVideo) {
        requestBody.videoData = uploadedVideo;
      } else if (analysisMode === 'youtube') {
        requestBody.youtubeUrl = youtubeUrl;
      }

      // Only add API key if not using Vertex AI
      if (!useVertexAI) {
        requestBody.apiKey = localStorage.getItem('gemini_api_key');
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
      setAuthMode(data.mode || 'api-key'); // Set the actual mode used
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析视频时出错');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000); // 2秒后隐藏提示
      } else {
        // 回退方案：使用传统的文本选择方式
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          document.execCommand('copy');
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2000); // 2秒后隐藏提示
        } catch (err) {
          console.error('复制失败:', err);
          setError('复制失败，请手动选择文本复制');
        }
        
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error('复制到剪贴板失败:', err);
      setError('复制失败，请手动选择文本复制');
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
    'Please provide a paragraph describing this video.',
    '请总结这个视频的主要内容',
    '描述视频中的关键场景和人物',
    '提取视频中的文字信息',
    '分析视频的情感基调',
    '列出视频中提到的重要观点'
  ];

  // 专用提示词模板
  const AUDIO_VIDEO_DESCRIPTION_PROMPT = `Your task is to strictly adhere to the following format and rules to generate a description for a video.

**Core Formatting Rules:**
1.  **Structure:** The description must be divided into two main paragraphs. The first paragraph describes the visual content, and the second describes the audio and dialogue.
2.  **Dialogue Handling (Most Important):** If the dialogue in the video is not in English, you must follow these rules:
    *   First, specify the language of the dialogue, for example, \`...says in Chinese...\` or \`...exchange in Chinese.\`
    *   Next, describe the tone of voice, such as \`...in a relaxed and cheerful tone:\`.
    *   Then, **provide only the English translation of the dialogue**, enclosed in quotation marks.
    *   **Strictly Prohibited:** **Do not include any non-English characters (e.g., Chinese characters), pinyin, or any form of transliteration in the final output.** The only representation of the dialogue should be its English translation.

Please strictly refer to the example below, which perfectly demonstrates the rules above.

\`\`\`Reference Video Prompt Format Example
A highly realistic, photorealistic macaque monkey, wearing a vibrant green Hawaiian floral shirt and a green baseball cap, is vlogging in front of a beautiful waterfall in a lush, dense jungle. The shot is a dynamic first-person POV (Point of View) from a camera held by the monkey's outstretched, hairy arm, giving it a GoPro or action camera feel with a wide-angle lens. The monkey stands by a clear, shallow stream.

The monkey looks directly into the lens, talking animatedly with a cheerful expression. Its mouth movements are perfectly synchronized with its speech.

For the audio and dialogue, the model should generate synchronized audio where the monkey says in Chinese, in a relaxed and cheerful tone: "Hey guys, it's so much nicer in the mountains! The temperature isn't as high here. I'm getting ready to go catch some fish in a bit."

The primary ambient sound is the clear, continuous sound of the waterfall and the gentle stream in the foreground.
\`\`\``;

  const SHOT_DESCRIPTION_PROMPT = `Analyze this video and identify its shots. For each shot, list its start and end times and provide a paragraph describing its content.`;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-gray-900">视频分析</CardTitle>
        <CardDescription>
          使用 Gemini AI 分析视频内容，支持上传视频或分析YouTube视频
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 当前认证模式状态显示 */}
        {authMode && (
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
            <div className="text-sm text-blue-900">
              <strong>当前认证模式:</strong> {authMode === 'vertex-ai' ? 'Vertex AI (多用户并发支持)' : 'API Key (个人使用)'}
            </div>
            <div className="text-xs text-blue-700 mt-1">
              可在页面顶部切换认证模式
            </div>
          </div>
        )}

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

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">专业提示词模板</label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPrompt(AUDIO_VIDEO_DESCRIPTION_PROMPT)}
              className="text-xs bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700"
            >
              生成音视频描述
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPrompt(SHOT_DESCRIPTION_PROMPT)}
              className="text-xs bg-green-50 hover:bg-green-100 border border-green-200 text-green-700"
            >
              生成分镜描述
            </Button>
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

        {copySuccess && (
          <div className="p-3 rounded-lg bg-green-50 border border-green-200">
            <p className="text-sm text-green-600">✓ 分析结果已复制到剪贴板</p>
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
                onClick={() => copyToClipboard(result)}
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
