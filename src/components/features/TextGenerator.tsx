'use client';

import { useState } from 'react';
import { Button } from '~/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/Card';
import { Input } from '~/components/ui/Input';
export function TextGenerator() {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('请输入文本提示');
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
        body: JSON.stringify({ prompt }),
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

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-gray-900">文本生成</CardTitle>
        <CardDescription>
          使用 Gemini AI 生成高质量的中文文本内容
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="text-prompt" className="text-sm font-medium text-gray-700">
            文本提示
          </label>
          <Input
            id="text-prompt"
            placeholder="输入您想要生成的文本内容的描述..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleGenerate()}
          />
        </div>
        
        <Button 
          onClick={handleGenerate} 
          loading={loading}
          disabled={loading || !prompt.trim()}
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
