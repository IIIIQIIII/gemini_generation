'use client';

export function Header() {
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
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500">
              文本 · 图片 · 视频
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
