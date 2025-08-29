'use client';

import { useState, useRef } from 'react';
import { Button } from '~/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/Card';
import { Input } from '~/components/ui/Input';
export function ImageGenerator() {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        // Remove the data:image/jpeg;base64, prefix
        const base64Data = base64.split(',')[1];
        setUploadedImage(base64Data || null);
        setEditMode(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('请输入图片描述');
      return;
    }

    setLoading(true);
    setError('');
    setResult('');

    try {
      let response;
      if (editMode && uploadedImage) {
        response = await fetch('/api/edit-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt, imageData: uploadedImage }),
        });
      } else {
        response = await fetch('/api/generate-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt }),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '生成图片时出错');
      }

      setResult(data.imageData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成图片时出错');
    } finally {
      setLoading(false);
    }
  };

  const resetToGenerate = () => {
    setEditMode(false);
    setUploadedImage(null);
    setResult('');
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadImage = () => {
    if (result) {
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${result}`;
      link.download = 'generated-image.png';
      link.click();
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-gray-900">
          {editMode ? '图片编辑' : '图片生成'}
        </CardTitle>
        <CardDescription>
          {editMode 
            ? '上传图片并使用文本描述进行编辑' 
            : '使用 Gemini AI 根据文本描述生成图片'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            variant={!editMode ? "primary" : "secondary"}
            onClick={resetToGenerate}
            size="sm"
          >
            文本生成图片
          </Button>
          <Button
            variant={editMode ? "primary" : "secondary"}
            onClick={() => setEditMode(true)}
            size="sm"
          >
            图片编辑
          </Button>
        </div>

        {editMode && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              上传图片
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {uploadedImage && (
              <div className="mt-2">
                <img
                  src={`data:image/jpeg;base64,${uploadedImage}`}
                  alt="Uploaded"
                  className="max-w-full h-auto rounded-lg border border-gray-200"
                  style={{ maxHeight: '200px' }}
                />
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="image-prompt" className="text-sm font-medium text-gray-700">
            {editMode ? '编辑指令' : '图片描述'}
          </label>
          <Input
            id="image-prompt"
            placeholder={
              editMode 
                ? "描述您想要对图片进行的修改..." 
                : "描述您想要生成的图片..."
            }
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleGenerate()}
          />
        </div>
        
        <Button 
          onClick={handleGenerate} 
          loading={loading}
          disabled={loading || !prompt.trim() || (editMode && !uploadedImage)}
          variant="primary"
          className="w-full"
        >
          {loading ? (editMode ? '编辑中...' : '生成中...') : (editMode ? '编辑图片' : '生成图片')}
        </Button>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">生成结果</label>
            <div className="border border-gray-200 rounded-lg p-2">
              <img
                src={`data:image/png;base64,${result}`}
                alt="Generated"
                className="w-full h-auto rounded-lg"
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={downloadImage}
              className="w-full"
            >
              下载图片
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
