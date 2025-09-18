'use client';

import { useState } from 'react';
import { Button } from '~/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/Card';
import { Input } from '~/components/ui/Input';
import { useAuth } from '~/components/layout/Header';
import { useQueue } from '~/hooks/useQueue';
import { QueueStatus } from './QueueStatus';

// 复制原来的提示词模板
const PROMPT_TEMPLATES = [
  { id: 'free-chat', label: 'AI对话模式', template: '' },
  { id: 'translate-to-chinese', label: '中文翻译下文', template: '中文翻译下文:\n\n' },
  { id: 'translate-to-english', label: '英文翻译下文', template: '英文翻译下文:\n\n' },
  { id: 'explain', label: '请解释下文', template: '请解释下文:\n\n' },
  { id: 'summarize', label: '请总结下文', template: '请总结下文:\n\n' }
];

// 复制原来的复制函数
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

export function TextGeneratorWithQueue() {
  const { useVertexAI } = useAuth();
  const { submitToQueue, clearQueueState, isQueuing, queueItemId, queueError } = useQueue();
  
  const [selectedTemplate, setSelectedTemplate] = useState('free-chat');
  const [userText, setUserText] = useState('');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [authMode, setAuthMode] = useState('');
  const [copyStatus, setCopyStatus] = useState<{ message: string; type: 'success' | 'error' | '' }>({ message: '', type: '' });

  // 生成最终的提示词
  const generateFinalPrompt = () => {
    if (selectedTemplate === 'free-chat') {
      return userText;
    }
    
    const template = PROMPT_TEMPLATES.find(t => t.id === selectedTemplate);
    if (!template) return '';
    
    return template.template + userText;
  };

  const handleGenerate = async () => {
    const finalPrompt = generateFinalPrompt();
    
    if (!finalPrompt.trim()) {
      if (selectedTemplate === 'free-chat') {
        setError('请输入您想要询问的内容');
      } else {
        setError('请输入要处理的文本内容');
      }
      return;
    }

    if (!useVertexAI) {
      const apiKey = localStorage.getItem('gemini_api_key');
      if (!apiKey) {
        setError('请先设置API Key，或选择Vertex AI模式');
        return;
      }
    }

    setError('');
    setResult('');
    setAuthMode('');
    clearQueueState();

    const requestData: any = { 
      prompt: finalPrompt, 
      useVertexAI: useVertexAI 
    };

    if (!useVertexAI) {
      requestData.apiKey = localStorage.getItem('gemini_api_key');
    }

    // 提交到队列
    const queueResult = await submitToQueue('generate-text', requestData);
    
    if (!queueResult.success) {
      setError(queueResult.error || '提交到队列失败');
    }
  };

  // 处理队列完成
  const handleQueueComplete = (result: any) => {
    setResult(result.text);
    setAuthMode(result.mode || 'api-key');
    clearQueueState();
  };

  // 处理队列错误
  const handleQueueError = (error: string) => {
    setError(error);
    clearQueueState();
  };

  // 处理复制功能
  const handleCopy = async () => {
    setCopyStatus({ message: '', type: '' });
    
    const copyResult = await copyToClipboard(result);
    setCopyStatus({
      message: copyResult.message,
      type: copyResult.success ? 'success' : 'error'
    });

    setTimeout(() => {
      setCopyStatus({ message: '', type: '' });
    }, 3000);
  };

  const canGenerate = () => {
    return userText.trim().length > 0;
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-gray-900">文本生成</CardTitle>
        <CardDescription>
          使用 Gemini AI 生成高质量的中文文本内容
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

        {/* 排队状态显示 */}
        {queueItemId && (
          <QueueStatus
            itemId={queueItemId}
            onComplete={handleQueueComplete}
            onError={handleQueueError}
          />
        )}

        {/* 提示词模板选择器 */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            选择提示词模板
          </label>
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {PROMPT_TEMPLATES.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </select>
        </div>

        {/* 根据选择的模板显示不同的输入框 */}
        <div className="space-y-2">
          <label htmlFor="user-text" className="text-sm font-medium text-gray-700">
            {selectedTemplate === 'free-chat' ? '询问内容' : '输入要处理的文本'}
          </label>
          <textarea
            id="user-text"
            placeholder={
              selectedTemplate === 'free-chat' 
                ? "输入您想要询问AI的问题或内容..." 
                : "输入您要处理的文本内容..."
            }
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical min-h-[100px]"
          />
        </div>

        {/* 预览最终提示词 */}
        {selectedTemplate !== 'free-chat' && userText.trim() && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              最终提示词预览
            </label>
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
              <p className="text-sm text-blue-900 whitespace-pre-wrap">{generateFinalPrompt()}</p>
            </div>
          </div>
        )}
        
        <Button 
          onClick={handleGenerate} 
          loading={isQueuing}
          disabled={isQueuing || !canGenerate() || !!queueItemId}
          variant="primary"
          className="w-full"
        >
          {isQueuing ? '提交到队列...' : queueItemId ? '处理中...' : '生成文本'}
        </Button>

        {(error || queueError) && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">{error || queueError}</p>
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">生成结果</label>
            <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
              <p className="text-sm text-gray-900 whitespace-pre-wrap">{result}</p>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopy}
              >
                复制文本
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
