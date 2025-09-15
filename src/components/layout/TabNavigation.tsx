'use client';

import { useState } from 'react';
import { Button } from '~/components/ui/Button';

interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  const tabs = [
    { id: 'text', label: '文本生成', icon: '📝' },
    { id: 'image', label: '图片生成', icon: '🎨' },
    { id: 'image-analyze', label: '图片分析', icon: '🔍' },
    { id: 'video-generate', label: '视频生成', icon: '🎬' },
    { id: 'video', label: '视频分析', icon: '📹' },
    { id: 'subtitle', label: '字幕生成', icon: '🎤' },
    { id: 'speech', label: '语音合成', icon: '🎙️' },
  ];

  return (
    <div className="flex justify-center mb-8">
      <div className="flex bg-gray-100 rounded-lg p-1">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "primary" : "ghost"}
            onClick={() => onTabChange(tab.id)}
            className="px-4 py-2 text-sm font-medium"
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
