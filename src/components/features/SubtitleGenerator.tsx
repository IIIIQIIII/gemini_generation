'use client';

import { useState, useRef } from 'react';
import { Button } from '~/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/Card';
import { Input } from '~/components/ui/Input';

// Robust clipboard copy utility function
const copyToClipboard = async (text: string): Promise<{ success: boolean; message: string }> => {
  if (typeof window === 'undefined') {
    return { success: false, message: '不支持服务器端复制' };
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return { success: true, message: '复制成功！' };
    } catch (err) {
      console.warn('Clipboard API failed:', err);
    }
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.left = '-9999px';
    
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, 99999);
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    
    if (successful) {
      return { success: true, message: '复制成功！' };
    } else {
      return { success: false, message: '复制失败，请手动复制' };
    }
  } catch (err) {
    console.error('Legacy copy method failed:', err);
    return { success: false, message: '复制功能不可用，请手动复制' };
  }
};

// 时间戳转换函数
const formatTimestamp = (milliseconds: number): string => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ms = milliseconds % 1000;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
};

// 导出SRT格式字幕
const exportToSRT = (utterances: any[]): string => {
  let srtContent = '';
  utterances.forEach((utterance, index) => {
    const startTime = formatTimestamp(utterance.start_time);
    const endTime = formatTimestamp(utterance.end_time);
    srtContent += `${index + 1}\n`;
    srtContent += `${startTime} --> ${endTime}\n`;
    srtContent += `${utterance.text}\n\n`;
  });
  return srtContent;
};

// 支持的语言选项
const LANGUAGE_OPTIONS = [
  { value: 'zh-CN', label: '中文普通话（简体）' },
  { value: 'yue', label: '粤语' },
  { value: 'wuu', label: '吴语-上海话' },
  { value: 'nan', label: '闽南语' },
  { value: 'xghu', label: '西南官话' },
  { value: 'zgyu', label: '中原官话' },
  { value: 'ug', label: '维语' },
  { value: 'en-US', label: '英语（美国）' },
  { value: 'ja-JP', label: '日语' },
  { value: 'ko-KR', label: '韩语' },
  { value: 'es-MX', label: '西班牙语' },
  { value: 'ru-RU', label: '俄语' },
  { value: 'fr-FR', label: '法语' },
];

// 字幕类型选项
const CAPTION_TYPE_OPTIONS = [
  { value: 'auto', label: '自动识别（说话+唱歌）' },
  { value: 'speech', label: '仅识别说话部分' },
  { value: 'singing', label: '仅识别唱歌部分' },
];

interface SubtitleResult {
  taskId: string;
  duration: number;
  utterances: Array<{
    text: string;
    start_time: number;
    end_time: number;
    words?: Array<{
      text: string;
      start_time: number;
      end_time: number;
    }>;
  }>;
}

export function SubtitleGenerator() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [language, setLanguage] = useState('zh-CN');
  const [captionType, setCaptionType] = useState('auto');
  const [wordsPerLine, setWordsPerLine] = useState('15');
  const [maxLines, setMaxLines] = useState('1');
  const [useItn, setUseItn] = useState(true);
  const [usePunc, setUsePunc] = useState(true);
  const [result, setResult] = useState<SubtitleResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState<{ message: string; type: 'success' | 'error' | '' }>({ message: '', type: '' });
  const [taskId, setTaskId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file size (limit to 100MB)
      if (file.size > 100 * 1024 * 1024) {
        setError('文件大小不能超过100MB');
        return;
      }
      
      // Check file type
      const allowedTypes = ['audio/', 'video/'];
      const isValidType = allowedTypes.some(type => file.type.startsWith(type));
      
      if (!isValidType) {
        setError('请选择音频或视频文件');
        return;
      }
      
      setAudioFile(file);
      setError('');
      setResult(null);
    }
  };

  const handleGenerate = async () => {
    if (!audioFile) {
      setError('请先选择音频或视频文件');
      return;
    }

    setLoading(true);
    setProcessing(true);
    setError('');
    setResult(null);

    try {
      // Step 1: Submit audio for processing
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('language', language);
      formData.append('caption_type', captionType);
      formData.append('words_per_line', wordsPerLine);
      formData.append('max_lines', maxLines);
      formData.append('use_itn', useItn.toString());
      formData.append('use_punc', usePunc.toString());

      const submitResponse = await fetch('/api/subtitle/submit', {
        method: 'POST',
        body: formData,
      });

      const submitData = await submitResponse.json();

      if (!submitResponse.ok) {
        throw new Error(submitData.error || '提交任务失败');
      }

      setTaskId(submitData.taskId);
      setLoading(false);

      // Step 2: Poll for results
      let attempts = 0;
      const maxAttempts = 60; // 最多等待5分钟
      
      const pollResults = async (): Promise<void> => {
        try {
          const queryResponse = await fetch(`/api/subtitle/query?taskId=${submitData.taskId}&blocking=1`);
          const queryData = await queryResponse.json();

          if (!queryResponse.ok) {
            throw new Error(queryData.error || '查询结果失败');
          }

          if (queryData.status === 'completed') {
            setResult({
              taskId: queryData.taskId,
              duration: queryData.duration,
              utterances: queryData.utterances,
            });
            setProcessing(false);
          } else if (queryData.status === 'processing') {
            attempts++;
            if (attempts >= maxAttempts) {
              throw new Error('处理超时，请重试');
            }
            // Wait 5 seconds before next poll
            setTimeout(pollResults, 5000);
          } else {
            throw new Error(queryData.error || '处理失败');
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : '查询结果时出错');
          setProcessing(false);
        }
      };

      // Start polling
      setTimeout(pollResults, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : '生成字幕时出错');
      setLoading(false);
      setProcessing(false);
    }
  };

  const handleCopy = async (content: string) => {
    setCopyStatus({ message: '', type: '' });
    
    const copyResult = await copyToClipboard(content);
    setCopyStatus({
      message: copyResult.message,
      type: copyResult.success ? 'success' : 'error'
    });

    setTimeout(() => {
      setCopyStatus({ message: '', type: '' });
    }, 3000);
  };

  const handleDownloadSRT = () => {
    if (!result) return;
    
    const srtContent = exportToSRT(result.utterances);
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${audioFile?.name || 'subtitle'}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-gray-900">🎬 音视频字幕生成</CardTitle>
        <CardDescription>
          使用 ByteDance 语音识别技术，为您的音视频文件生成精准字幕
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* 文件上传区域 */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            选择音频或视频文件
          </label>
          <div className="flex items-center space-x-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button 
              variant="secondary" 
              onClick={() => fileInputRef.current?.click()}
            >
              选择文件
            </Button>
            {audioFile && (
              <span className="text-sm text-gray-600">
                已选择: {audioFile.name} ({(audioFile.size / (1024 * 1024)).toFixed(2)} MB)
              </span>
            )}
          </div>
        </div>

        {/* 参数设置 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">语言类型</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">识别类型</label>
            <select
              value={captionType}
              onChange={(e) => setCaptionType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {CAPTION_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">每行字数</label>
            <Input
              type="number"
              value={wordsPerLine}
              onChange={(e) => setWordsPerLine(e.target.value)}
              min="10"
              max="50"
              placeholder="15"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">最大行数</label>
            <Input
              type="number"
              value={maxLines}
              onChange={(e) => setMaxLines(e.target.value)}
              min="1"
              max="3"
              placeholder="1"
            />
          </div>
        </div>

        {/* 高级选项 */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">高级选项</h4>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={useItn}
                onChange={(e) => setUseItn(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">数字转换（中文数字→阿拉伯数字）</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={usePunc}
                onChange={(e) => setUsePunc(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">添加标点符号</span>
            </label>
          </div>
        </div>
        
        <Button 
          onClick={handleGenerate} 
          loading={loading}
          disabled={loading || processing || !audioFile}
          variant="primary"
          className="w-full"
        >
          {loading ? '提交中...' : processing ? '处理中...' : '生成字幕'}
        </Button>

        {processing && (
          <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <p className="text-sm text-blue-900">
                正在处理音频文件，请稍候... (任务ID: {taskId})
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-700">字幕结果</h4>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span>时长: {formatDuration(result.duration)}</span>
                <span>•</span>
                <span>共 {result.utterances.length} 句</span>
              </div>
            </div>
            
            {/* 字幕预览 */}
            <div className="max-h-96 overflow-y-auto p-4 rounded-lg bg-gray-50 border border-gray-200">
              {result.utterances.map((utterance, index) => (
                <div key={index} className="mb-3 pb-3 border-b border-gray-200 last:border-b-0">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs text-gray-500">
                      #{index + 1} {formatTimestamp(utterance.start_time)} → {formatTimestamp(utterance.end_time)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-900">{utterance.text}</p>
                </div>
              ))}
            </div>
            
            {/* 操作按钮 */}
            <div className="flex items-center space-x-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleCopy(result.utterances.map(u => u.text).join('\n'))}
              >
                复制文本
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleCopy(exportToSRT(result.utterances))}
              >
                复制SRT格式
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDownloadSRT}
              >
                下载SRT文件
              </Button>
              {copyStatus.message && (
                <span className={`text-sm ${copyStatus.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                  {copyStatus.message}
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
