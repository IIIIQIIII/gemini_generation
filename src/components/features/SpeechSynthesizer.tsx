'use client';

import { useState, useRef } from 'react';
import { api } from '~/trpc/react';
import { Button } from '~/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '~/components/ui/Card';
import { cn } from '~/lib/utils';

export function SpeechSynthesizer() {
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('zh_male_beijingxiaoye_emo_v2_mars_bigtts');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const { data: voiceTypes } = api.speech.getVoiceTypes.useQuery();
  const synthesizeMutation = api.speech.synthesize.useMutation({
    onSuccess: (data) => {
      // Convert base64 to blob URL for audio playback
      const base64Audio = data.audioBase64;
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/mp3' });
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      
      // Auto-play the audio
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play().catch(console.error);
      }
    },
    onError: (error) => {
      console.error('Speech synthesis error:', error);
    }
  });

  const handleSynthesize = () => {
    if (!text.trim()) return;
    synthesizeMutation.mutate({ text: text.trim(), voiceType: selectedVoice });
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `speech-${Date.now()}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const clearAudio = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    if (audioRef.current) {
      audioRef.current.src = '';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🎙️ 语音合成
          </CardTitle>
          <CardDescription>
            使用火山引擎TTS将文本转换为自然的语音
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Text Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              输入文本 (最多300字符)
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="请输入要转换为语音的文本..."
              className={cn(
                "w-full min-h-[120px] p-3 border border-gray-200 rounded-lg resize-none",
                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                "placeholder:text-gray-400"
              )}
              maxLength={300}
            />
            <div className="text-xs text-gray-500 text-right">
              {text.length}/300 字符
            </div>
          </div>

          {/* Voice Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              选择音色
            </label>
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className={cn(
                "w-full p-2 border border-gray-200 rounded-lg",
                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              )}
            >
              {voiceTypes?.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name} - {voice.language}
                </option>
              ))}
            </select>
            {voiceTypes?.find(v => v.id === selectedVoice) && (
              <div className="text-xs text-gray-500">
                {voiceTypes.find(v => v.id === selectedVoice)?.description}
              </div>
            )}
          </div>

          {/* Synthesize Button */}
          <Button
            onClick={handleSynthesize}
            disabled={!text.trim() || synthesizeMutation.isPending}
            loading={synthesizeMutation.isPending}
            variant="primary"
            size="lg"
            className="w-full"
          >
            {synthesizeMutation.isPending ? '正在合成中...' : '开始语音合成'}
          </Button>

          {/* Error Display */}
          {synthesizeMutation.error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-sm text-red-700">
                合成失败: {synthesizeMutation.error.message}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audio Player */}
      {audioUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🔊 语音播放
            </CardTitle>
            <CardDescription>
              合成完成！点击播放按钮试听效果
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <audio
              ref={audioRef}
              controls
              className="w-full"
              preload="metadata"
            >
              您的浏览器不支持音频播放。
            </audio>
            
            <div className="flex gap-2">
              <Button
                onClick={handleDownload}
                variant="secondary"
                className="flex-1"
              >
                📥 下载音频
              </Button>
              <Button
                onClick={clearAudio}
                variant="ghost"
                className="flex-1"
              >
                🗑️ 清除音频
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            💡 使用提示
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>• 支持中文文本，建议控制在300字符以内获得最佳效果</li>
            <li>• 提供多种音色选择，包括多情感支持的声音</li>
            <li>• 合成的音频为MP3格式，可直接播放和下载</li>
            <li>• 音频质量为24kHz，适合大多数使用场景</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
