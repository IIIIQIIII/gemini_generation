'use client';

import { useState } from 'react';
import { Button } from '~/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/Card';

// 复制clipboard功能测试组件
export function ClipboardTest() {
  const [testText, setTestText] = useState('这是一段测试文本，用于验证复制功能是否正常工作。\n\n支持多行文本和特殊字符：!@#$%^&*()');
  const [results, setResults] = useState<Array<{ test: string; result: string; success: boolean }>>([]);

  // 引用我们修复的copyToClipboard函数
  const copyToClipboard = async (text: string): Promise<{ success: boolean; message: string }> => {
    if (typeof window === 'undefined') {
      return { success: false, message: '不支持服务器端复制' };
    }

    // Method 1: Modern Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return { success: true, message: '复制成功 (Clipboard API)' };
      } catch (err) {
        console.warn('Clipboard API failed:', err);
        // Fall through to legacy method
      }
    }

    // Method 2: Legacy execCommand fallback
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
        return { success: true, message: '复制成功 (execCommand fallback)' };
      } else {
        return { success: false, message: '复制失败，请手动复制' };
      }
    } catch (err) {
      console.error('Legacy copy method failed:', err);
      return { success: false, message: '复制功能不可用，请手动复制' };
    }
  };

  // 测试现代Clipboard API
  const testClipboardAPI = async () => {
    const startTime = Date.now();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(testText);
        const duration = Date.now() - startTime;
        addResult('Clipboard API 测试', `成功 (${duration}ms)`, true);
      } else {
        addResult('Clipboard API 测试', 'API不可用', false);
      }
    } catch (err) {
      const duration = Date.now() - startTime;
      addResult('Clipboard API 测试', `失败: ${err instanceof Error ? err.message : 'Unknown error'} (${duration}ms)`, false);
    }
  };

  // 测试execCommand fallback
  const testExecCommand = async () => {
    const startTime = Date.now();
    try {
      const textarea = document.createElement('textarea');
      textarea.value = testText;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.left = '-9999px';
      
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, 99999);
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      
      const duration = Date.now() - startTime;
      if (successful) {
        addResult('execCommand 测试', `成功 (${duration}ms)`, true);
      } else {
        addResult('execCommand 测试', `失败 (${duration}ms)`, false);
      }
    } catch (err) {
      const duration = Date.now() - startTime;
      addResult('execCommand 测试', `异常: ${err instanceof Error ? err.message : 'Unknown error'} (${duration}ms)`, false);
    }
  };

  // 测试robust复制函数
  const testRobustCopy = async () => {
    const startTime = Date.now();
    const result = await copyToClipboard(testText);
    const duration = Date.now() - startTime;
    addResult('Robust 复制测试', `${result.message} (${duration}ms)`, result.success);
  };

  // 测试环境检测
  const testEnvironmentDetection = () => {
    const results = [
      `浏览器环境: ${typeof window !== 'undefined' ? '✓' : '✗'}`,
      `navigator 对象: ${typeof navigator !== 'undefined' ? '✓' : '✗'}`,
      `clipboard API: ${navigator?.clipboard ? '✓' : '✗'}`,
      `writeText 方法: ${navigator?.clipboard && typeof navigator.clipboard.writeText === 'function' ? '✓' : '✗'}`,
      `execCommand 支持: ${typeof document?.execCommand === 'function' ? '✓' : '✗'}`,
      `HTTPS/localhost: ${location?.protocol === 'https:' || location?.hostname === 'localhost' ? '✓' : '✗'}`
    ].join('\n');
    
    addResult('环境检测', results, true);
  };

  const addResult = (test: string, result: string, success: boolean) => {
    setResults(prev => [...prev, { test, result, success }]);
  };

  const clearResults = () => {
    setResults([]);
  };

  const runAllTests = async () => {
    clearResults();
    testEnvironmentDetection();
    await testClipboardAPI();
    await testExecCommand();
    await testRobustCopy();
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-gray-900">Clipboard 复制功能测试</CardTitle>
        <CardDescription>
          测试不同复制方法的兼容性和可用性
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 测试文本输入 */}
        <div className="space-y-2">
          <label htmlFor="test-text" className="text-sm font-medium text-gray-700">
            测试文本
          </label>
          <textarea
            id="test-text"
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical min-h-[100px]"
            placeholder="输入要测试复制的文本..."
          />
        </div>

        {/* 测试按钮 */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Button
            onClick={testEnvironmentDetection}
            variant="secondary"
            size="sm"
          >
            环境检测
          </Button>
          <Button
            onClick={testClipboardAPI}
            variant="secondary"
            size="sm"
          >
            测试 Clipboard API
          </Button>
          <Button
            onClick={testExecCommand}
            variant="secondary"
            size="sm"
          >
            测试 execCommand
          </Button>
          <Button
            onClick={testRobustCopy}
            variant="secondary"
            size="sm"
          >
            测试 Robust 复制
          </Button>
          <Button
            onClick={runAllTests}
            variant="primary"
            size="sm"
          >
            运行全部测试
          </Button>
          <Button
            onClick={clearResults}
            variant="secondary"
            size="sm"
          >
            清除结果
          </Button>
        </div>

        {/* 测试结果 */}
        {results.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">测试结果</label>
            <div className="space-y-2">
              {results.map((result, index) => (
                <div key={index} className={`p-3 rounded-lg border ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="font-medium text-sm text-gray-900">{result.test}</div>
                  <div className={`text-sm ${result.success ? 'text-green-600' : 'text-red-600'} whitespace-pre-line`}>
                    {result.result}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 使用说明 */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">测试说明</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>环境检测</strong>: 检查浏览器API支持情况</li>
            <li>• <strong>Clipboard API</strong>: 测试现代剪贴板API</li>
            <li>• <strong>execCommand</strong>: 测试传统复制方法</li>
            <li>• <strong>Robust 复制</strong>: 测试我们的容错复制函数</li>
            <li>• 复制后可以粘贴到任意文本框验证结果</li>
            <li>• 在不同浏览器和环境下测试兼容性</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
