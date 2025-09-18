'use client';

import { useState, useEffect } from 'react';
import { Header, AuthProvider } from '~/components/layout/Header';
import { TabNavigation } from '~/components/layout/TabNavigation';
import { TextGenerator } from '~/components/features/TextGenerator';
import { ImageGenerator } from '~/components/features/ImageGenerator';
import { ImageAnalyzer } from '~/components/features/ImageAnalyzer';
import { VideoGenerator } from '~/components/features/VideoGenerator';
import { VideoAnalyzer } from '~/components/features/VideoAnalyzer';
import { SubtitleGenerator } from '~/components/features/SubtitleGenerator';
import { SpeechSynthesizer } from '~/components/features/SpeechSynthesizer';
import { ApiKeyInput } from '~/components/ui/ApiKeyInput';
import { GlobalQueueStatus } from '~/components/layout/GlobalQueueStatus';

export default function Home() {
  const [activeTab, setActiveTab] = useState('text');
  const [apiKey, setApiKey] = useState<string | null>(null);

  // Load API key from localStorage on mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem('gemini_api_key');
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
  }, []);

  const handleApiKeySet = (newApiKey: string) => {
    setApiKey(newApiKey);
  };

  const renderActiveComponent = () => {
    switch (activeTab) {
      case 'text':
        return <TextGenerator />;
      case 'image':
        return <ImageGenerator />;
      case 'image-analyze':
        return <ImageAnalyzer />;
      case 'video-generate':
        return <VideoGenerator />;
      case 'video':
        return <VideoAnalyzer />;
      case 'subtitle':
        return <SubtitleGenerator />;
      case 'speech':
        return <SpeechSynthesizer />;
      default:
        return <TextGenerator />;
    }
  };

  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              AI 多模态创作平台
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              基于 Gemini 2.5 Flash 和 Veo AI 的强大能力，为您提供文本生成、图片创作、视频生成和视频分析功能。
              简洁、高效、智能的多模态创作体验。
            </p>
          </div>
          
          {/* API Key Input - Always shown at the top */}
          <ApiKeyInput apiKey={apiKey} onApiKeySet={handleApiKeySet} />
          
          <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
          
          {/* 全局排队状态显示 */}
          <div className="max-w-2xl mx-auto mb-6">
            <GlobalQueueStatus />
          </div>
          
          <div className="flex justify-center">
            {apiKey ? renderActiveComponent() : (
              <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="text-center space-y-4">
                  <div className="text-6xl">🔐</div>
                  <h3 className="text-xl font-semibold text-gray-900">需要 API Key</h3>
                  <p className="text-gray-600">
                    请先在上方设置您的 Google Gemini API Key 以使用AI功能
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-sm text-gray-500">
            <p>AI 创作工坊 - 让创意无限延伸</p>
            <p className="mt-2">Powered by Gemini 2.5 Flash | Built with Next.js & Tailwind CSS</p>
          </div>
        </div>
      </footer>
      </div>
    </AuthProvider>
  );
}
