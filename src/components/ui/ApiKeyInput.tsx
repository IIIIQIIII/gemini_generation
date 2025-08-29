'use client';

import { useState, useEffect } from 'react';
import { Input } from './Input';
import { Button } from './Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './Card';

interface ApiKeyInputProps {
  onApiKeySet: (apiKey: string) => void;
  apiKey: string | null;
}

export function ApiKeyInput({ onApiKeySet, apiKey }: ApiKeyInputProps) {
  const [inputKey, setInputKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (apiKey) {
      setInputKey(apiKey);
    }
  }, [apiKey]);

  const handleSetApiKey = async () => {
    if (!inputKey.trim()) {
      alert('请输入有效的API Key');
      return;
    }

    setIsValidating(true);
    
    try {
      // Test the API key by making a simple request
      const response = await fetch('/api/validate-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: inputKey.trim() }),
      });

      const data = await response.json();
      
      if (response.ok && data.valid) {
        // Store in localStorage for session persistence
        localStorage.setItem('gemini_api_key', inputKey.trim());
        onApiKeySet(inputKey.trim());
        alert('API Key 验证成功！');
      } else {
        throw new Error(data.error || 'API Key验证失败');
      }
    } catch (error) {
      alert(`API Key验证失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsValidating(false);
    }
  };

  const handleClearKey = () => {
    localStorage.removeItem('gemini_api_key');
    setInputKey('');
    onApiKeySet('');
  };

  return (
    <Card className="w-full max-w-2xl mx-auto mb-6">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">
          🔐 API Key 配置
        </CardTitle>
        <CardDescription>
          请输入您的 Google Gemini API Key 以使用AI功能。API Key将仅在本地存储，不会上传到服务器。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!apiKey ? (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Google Gemini API Key *
              </label>
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  placeholder="AIzaSy..."
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  className="pr-20"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 px-2 py-1 text-xs"
                >
                  {showKey ? '隐藏' : '显示'}
                </Button>
              </div>
            </div>
            
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800 mb-2">
                <strong>如何获取 API Key:</strong>
              </p>
              <ol className="text-xs text-blue-700 space-y-1 ml-4 list-decimal">
                <li>访问 <a href="https://aistudio.google.com/apikey" target="_blank" className="underline">Google AI Studio</a></li>
                <li>登录您的Google账户</li>
                <li>点击"Create API Key"创建新的API Key</li>
                <li>复制API Key并粘贴到上方输入框</li>
                <li>确保您的Google Cloud账户已启用付费功能（Veo需要付费）</li>
              </ol>
            </div>
            
            <Button 
              onClick={handleSetApiKey}
              loading={isValidating}
              disabled={!inputKey.trim() || isValidating}
              variant="primary"
              className="w-full"
            >
              {isValidating ? '验证中...' : '设置 API Key'}
            </Button>
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
              <div>
                <p className="text-sm font-medium text-green-800">✅ API Key 已设置</p>
                <p className="text-xs text-green-600">
                  {showKey ? apiKey : `${apiKey.substring(0, 12)}${'*'.repeat(apiKey.length - 12)}`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? '隐藏' : '显示'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleClearKey}
                >
                  更换
                </Button>
              </div>
            </div>
          </div>
        )}
        
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs text-yellow-800">
            <strong>⚠️ 重要提醒:</strong> API Key仅存储在您的浏览器本地，不会发送到我们的服务器。使用AI功能产生的费用将直接从您的Google Cloud账户扣除。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
