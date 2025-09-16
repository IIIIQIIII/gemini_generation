'use client';

import { useState, createContext, useContext } from 'react';

// 创建全局认证模式上下文
interface AuthContextType {
  useVertexAI: boolean;
  setUseVertexAI: (value: boolean) => void;
  authMode: 'vertex-ai' | 'api-key' | '';
  setAuthMode: (mode: 'vertex-ai' | 'api-key' | '') => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [useVertexAI, setUseVertexAI] = useState(false);
  const [authMode, setAuthMode] = useState<'vertex-ai' | 'api-key' | ''>('');

  return (
    <AuthContext.Provider value={{ useVertexAI, setUseVertexAI, authMode, setAuthMode }}>
      {children}
    </AuthContext.Provider>
  );
}

export function Header() {
  const { useVertexAI, setUseVertexAI, authMode } = useAuth();

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-gray-900">
              AI 创作工坊
            </h1>
            <span className="ml-2 text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              Powered by Gemini
            </span>
          </div>
          
          {/* 全局认证模式选择器 */}
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-gray-700">认证模式:</span>
              <div className="flex items-center space-x-3">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="globalAuthMode"
                    checked={!useVertexAI}
                    onChange={() => setUseVertexAI(false)}
                    className="mr-1 text-blue-600"
                  />
                  <span className="text-sm text-gray-600">API Key</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="globalAuthMode"
                    checked={useVertexAI}
                    onChange={() => setUseVertexAI(true)}
                    className="mr-1 text-blue-600"
                  />
                  <span className="text-sm text-gray-600">Vertex AI</span>
                </label>
              </div>
              {authMode && (
                <div className="text-xs text-gray-500 bg-green-50 px-2 py-1 rounded">
                  {authMode === 'vertex-ai' ? '多用户并发' : '个人使用'}
                </div>
              )}
            </div>
            
            <div className="text-sm text-gray-500">
              文本 · 图片 · 视频 · 音频
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
