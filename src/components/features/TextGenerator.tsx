'use client';

import { useState } from 'react';
import { Button } from '~/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/Card';
import { Input } from '~/components/ui/Input';

// 预定义的提示词模板
const PROMPT_TEMPLATES = [
  { id: 'free-chat', label: 'AI对话模式', template: '' },
  { id: 'translate-to-chinese', label: '中文翻译下文', template: '中文翻译下文:\n\n' },
  { id: 'translate-to-english', label: '英文翻译下文', template: '英文翻译下文:\n\n' },
  { id: 'explain', label: '请解释下文', template: '请解释下文:\n\n' },
  { id: 'summarize', label: '请总结下文', template: '请总结下文:\n\n' }
];

export function TextGenerator() {
  const [selectedTemplate, setSelectedTemplate] = useState('free-chat');
  const [userText, setUserText] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 生成最终的提示词
  const generateFinalPrompt = () => {
    if (selectedTemplate === 'free-chat') {
      return userText; // AI对话模式直接使用用户输入
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

    // Get API key from localStorage
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      setError('请先设置API Key');
      return;
    }

    setLoading(true);
    setError('');
    setResult('');

    try {
      const response = await fetch('/api/generate-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: finalPrompt, apiKey }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '生成文本时出错');
      }

      setResult(data.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成文本时出错');
    } finally {
      setLoading(false);
    }
  };

  // 检查是否可以生成
  const canGenerate = () => {
    if (selectedTemplate === 'custom') {
      return customPrompt.trim().length > 0;
    }
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

        {/* 预览最终提示词（只在非AI对话模式且有内容时显示） */}
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
          loading={loading}
          disabled={loading || !canGenerate()}
          variant="primary"
          className="w-full"
        >
          {loading ? '生成中...' : '生成文本'}
        </Button>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">生成结果</label>
            <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
              <p className="text-sm text-gray-900 whitespace-pre-wrap">{result}</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigator.clipboard.writeText(result)}
            >
              复制文本
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
