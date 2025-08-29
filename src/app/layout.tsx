import "~/styles/globals.css";

import { type Metadata } from "next";

import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "AI 创作工坊 - 多模态AI创作平台",
  description: "基于 Gemini 2.5 Flash 和 Veo AI 的多模态创作平台，提供文本生成、图片创作、视频生成和视频分析功能",
  keywords: ["AI", "人工智能", "文本生成", "图片生成", "视频生成", "视频分析", "Gemini", "Veo", "创作工具"],
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
