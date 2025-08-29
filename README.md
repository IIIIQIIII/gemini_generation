# AI 创作工坊 - 多模态AI创作平台

一个基于 **Google Gemini 2.5 Flash** 和 **Veo AI** 的现代化多模态创作平台，提供文本生成、图片创作、视频生成和视频分析功能。采用 Apple UI 设计风格，简洁、高效、智能。

## ✨ 特性

- 🤖 **智能文本生成** - 基于 Gemini 2.5 Flash 的高质量中文文本创作
- 🎨 **图片生成与编辑** - 文本到图片生成，支持图片编辑和风格转换  
- 🎬 **AI视频生成** - 使用 Google Veo 3 Fast 和 Veo 2 生成高质量视频内容
- 📹 **视频智能分析** - 支持本地视频上传和 YouTube 视频链接分析
- 🔐 **用户自带API Key** - 安全的用户自备API密钥模式，零服务器成本
- 💾 **视频下载功能** - 支持生成视频的本地下载和新窗口播放
- 📱 **响应式设计** - 适配各种设备，优雅的 Apple UI 风格
- ⚡ **高性能架构** - Next.js 15 + TypeScript + Tailwind CSS
- 🔄 **智能重试机制** - 网络错误自动重试，提高稳定性

## 🚀 快速开始

### 环境要求

- Node.js 18+ 
- npm 或 yarn
- Google Gemini API 密钥 (用户自备)

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd ai-creation-studio
```

2. **安装依赖**
```bash
npm install
```

3. **启动开发服务器**
```bash
npm run dev
```

4. **访问应用**
打开浏览器访问 [http://localhost:3000](http://localhost:3000)

5. **设置API Key**
- 访问 [Google AI Studio](https://aistudio.google.com/apikey) 获取API Key
- 在应用页面顶部输入API Key
- 开始使用所有AI功能

## 🛠️ 技术栈

- **前端框架**: Next.js 15 (App Router)
- **编程语言**: TypeScript
- **样式框架**: Tailwind CSS 4.0
- **UI 组件**: 自定义组件库 (Apple UI 风格)
- **AI 集成**: Google Gemini 2.5 Flash API + Veo Video API
- **工具链**: ESLint, Prettier, T3 Stack

## 📂 项目结构

```
my-blog/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API 路由
│   │   │   ├── generate-text/ # 文本生成 API
│   │   │   ├── generate-image/# 图片生成 API
│   │   │   ├── edit-image/    # 图片编辑 API
│   │   │   ├── generate-video/# 视频生成 API (Veo)
│   │   │   ├── download-video/# 视频下载 API
│   │   │   ├── validate-key/  # API Key验证
│   │   │   ├── analyze-video/ # 视频分析 API
│   │   │   └── test-download/ # 下载功能测试
│   │   ├── layout.tsx         # 根布局
│   │   └── page.tsx           # 首页
│   ├── components/            # React 组件
│   │   ├── ui/               # 基础 UI 组件 (含API Key输入)
│   │   ├── layout/           # 布局组件
│   │   └── features/         # 功能组件
│   ├── lib/                  # 工具库
│   └── types/               # TypeScript 类型定义
├── public/                   # 静态资源
└── package.json             # 项目配置
```

## 🎯 功能模块

### 📝 文本生成
- 基于 Gemini 2.5 Flash 的高质量中文文本创作
- 支持各种写作场景和创意需求
- 实时生成，一键复制功能

### 🎨 图片生成
- **文本生成图片**: 根据描述创建高质量图片
- **图片编辑**: 上传图片进行 AI 驱动的智能编辑
- **下载功能**: 支持生成图片的本地保存

### 🎬 AI视频生成
- **Veo 3 Fast**: 8秒高质量视频，包含音频，快速生成
- **Veo 2**: 5-8秒视频，静音，更多配置选项
- **高级配置**: 支持宽高比、负面提示词、人物生成控制
- **智能下载**: 自动下载到本地存储，支持浏览器下载
- **新窗口播放**: 在新窗口中打开视频进行查看

### 📹 视频分析
- **本地视频分析**: 支持 20MB 以内的视频文件上传
- **YouTube 视频分析**: 直接分析 YouTube 视频内容
- **预设模板**: 提供常用分析指令模板
- **深度理解**: 场景描述、内容总结、情感分析

## 🔐 API Key 管理

### 用户自备API Key模式
- **安全性**: API Key 仅存储在用户浏览器本地
- **成本转移**: 所有API费用由用户自己承担
- **隐私保护**: API Key 不会发送到应用服务器
- **验证机制**: 内置API Key有效性验证

### 获取API Key步骤
1. 访问 [Google AI Studio](https://aistudio.google.com/apikey)
2. 登录Google账户
3. 点击 "Create API Key" 创建新密钥
4. 复制API Key到应用中
5. 确保Google Cloud账户已启用付费 (Veo需要付费)

## 🔧 API 接口

### POST /api/validate-key
验证API Key有效性

**请求体:**
```json
{
  "apiKey": "your_gemini_api_key"
}
```

**响应:**
```json
{
  "valid": true,
  "message": "API Key验证成功",
  "hasAccess": true
}
```

### POST /api/generate-video
生成视频 (需要API Key)

**请求体:**
```json
{
  "prompt": "一只可爱的小猫在花园里追蝴蝶",
  "model": "veo-3.0-fast-generate-preview",
  "config": {
    "aspectRatio": "16:9",
    "negativePrompt": "低质量",
    "personGeneration": "allow_all"
  },
  "apiKey": "your_api_key"
}
```

**响应:**
```json
{
  "videoUri": "/api/local-video?path=...",
  "videoFile": { "uri": "..." },
  "localVideoPath": "/tmp/...",
  "status": "completed"
}
```

### POST /api/download-video  
下载生成的视频

**请求体:**
```json
{
  "videoFile": { "uri": "..." },
  "localVideoPath": "/tmp/...",
  "apiKey": "your_api_key"
}
```

**响应**: 直接返回视频文件 (触发浏览器下载)

## 🚀 部署建议

### ✅ GitHub + Vercel 部署 (强烈推荐)

**优势：**
- ✅ **零成本运营**: 用户自备API Key，服务器无API费用
- ✅ **零风险**: 不涉及API Key管理和存储
- ✅ **易于部署**: 标准Next.js项目，一键部署
- ✅ **自动扩展**: Vercel自动处理流量扩展
- ✅ **全球CDN**: 自动全球内容分发
- ✅ **HTTPS**: 自动SSL证书

**部署步骤：**
1. 推送代码到GitHub
2. 连接Vercel账户到GitHub
3. 选择仓库进行部署
4. 无需设置任何环境变量 (用户自备API Key)
5. 自动部署完成

### 📊 部署可行性分析

| 方面 | 评估 | 说明 |
|------|------|------|
| **成本** | ⭐⭐⭐⭐⭐ | 零API成本，仅Vercel托管费用 |
| **安全性** | ⭐⭐⭐⭐⭐ | 无服务器API Key，安全风险极低 |
| **可扩展性** | ⭐⭐⭐⭐⭐ | 无状态架构，无限用户扩展 |
| **维护难度** | ⭐⭐⭐⭐ | 标准Next.js项目，维护简单 |
| **用户体验** | ⭐⭐⭐⭐ | 需要用户自备API Key，稍有门槛 |

### 🌍 其他部署选项

**Netlify:**
- 类似Vercel，免费托管
- 自动构建和部署
- 良好的性能表现

**Railway/Render:**
- 支持服务器端渲染
- Docker容器部署
- 适合需要更多服务器控制的场景

**VPS/云服务器:**
- 完全控制服务器环境
- 适合大流量或特殊需求
- 需要更多运维工作

## ⚠️ 部署注意事项

### 环境变量清理
```bash
# .env 文件已更新，移除了服务器API Key
# 无需设置 GEMINI_API_KEY 环境变量
```

### 临时文件处理
- 视频文件保存在 `/tmp` 目录
- Vercel等无状态平台会自动清理
- 包含自动清理机制

### 用户教育
- 提供清晰的API Key获取指南
- 说明费用由用户承担
- 强调数据隐私和安全

## 💡 商业化建议

### 适合的商业模式
1. **完全免费**: 用户自备API Key，零运营成本
2. **增值服务**: 提供API Key代理服务 (收取服务费)
3. **企业版**: 提供部署和定制服务
4. **模板市场**: 销售提示词模板和创作工具

### 目标用户群体
- **内容创作者**: 需要AI辅助创作的博主、编剧
- **企业用户**: 需要批量内容生成的企业
- **开发者**: 学习AI集成的技术人员
- **教育机构**: AI教学和演示用途

## 🤝 贡献指南

1. Fork 项目到你的 GitHub
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add: 新增某某功能'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 开源协议

本项目采用 **MIT License** - 查看 [LICENSE](LICENSE) 文件了解详情

## 🔗 相关链接

- [Google AI Studio](https://aistudio.google.com/apikey) - 获取API Key
- [Gemini API 文档](https://ai.google.dev/docs)
- [Veo Video API](https://developers.google.com/gemini/veo)
- [Next.js 文档](https://nextjs.org/docs)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)

## 📞 支持与反馈

如果你遇到任何问题或有建议，请：
- 创建 [GitHub Issue](https://github.com/your-username/ai-creation-studio/issues)
- 提交 Pull Request
- 或者通过项目页面联系

## 🏆 项目亮点

### 技术亮点
- ✅ **最新AI模型**: 集成Gemini 2.5 Flash和Veo 3.0
- ✅ **零服务器成本**: 用户自备API Key模式
- ✅ **健壮性设计**: 完善的错误处理和重试机制
- ✅ **TypeScript**: 全栈类型安全
- ✅ **现代化架构**: Next.js 15 + App Router

### 商业亮点
- ✅ **可直接商用**: MIT协议，无版权限制
- ✅ **零运营风险**: 无API费用和服务器维护成本
- ✅ **易于部署**: 一键部署到Vercel/Netlify
- ✅ **可扩展性**: 无状态设计，支持无限用户

---

**AI 创作工坊** - 让创意无限延伸，让技术服务创作 ✨

> 💡 **部署就绪**: 此项目已完全准备好部署到 GitHub + Vercel，无需任何额外配置！
