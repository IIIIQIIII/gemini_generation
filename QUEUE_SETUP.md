# 排队系统配置说明

## 概述

本项目已集成类似 Hugging Face Space 的排队系统，用于解决多用户同时使用时的 API 调用问题。

## 系统特性

- **智能队列管理**: 最多同时处理 2 个请求，避免 API 过载
- **实时状态显示**: 显示排队位置、预计等待时间、处理进度
- **自动轮询**: 自动检查队列状态，无需手动刷新
- **错误处理**: 完善的错误处理和用户反馈
- **全局状态**: 页面顶部显示整体队列状态

## 环境配置

### Cloudflare Pages 部署

由于项目部署在 Cloudflare Pages，环境变量需要在 Cloudflare Pages 控制台中配置：

1. 登录 Cloudflare Pages 控制台
2. 选择你的项目
3. 进入 "Settings" -> "Environment variables"
4. 添加以下环境变量：

```bash
# 必需的 API Key
GEMINI_API_KEY=your_gemini_api_key_here

# 可选：Vertex AI 配置（用于多用户并发）
GOOGLE_CLOUD_PROJECT=your_project_id
GOOGLE_CLOUD_LOCATION=global
GOOGLE_GENAI_USE_VERTEXAI=true
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account",...}

# 可选：排队系统配置
NEXT_PUBLIC_APP_URL=https://your-domain.pages.dev
```

### 本地开发

创建 `.env.local` 文件：

```bash
GEMINI_API_KEY=your_gemini_api_key_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 使用方法

### 1. 文本生成排队

文本生成功能已自动使用排队系统：

- 用户提交请求后，系统会显示排队状态
- 实时显示排队位置和预计等待时间
- 处理完成后自动显示结果

### 2. 队列状态监控

- 页面顶部显示全局队列状态
- 显示当前队列中的请求数量和处理中的请求数量
- 每 10 秒自动更新状态

### 3. 自定义并发数

如需调整同时处理的请求数量，修改 `src/lib/queue.ts` 中的 `maxConcurrent` 参数：

```typescript
export const queueManager = new QueueManager(3); // 改为 3 个并发
```

## 技术实现

### 队列管理器 (`src/lib/queue.ts`)

- 基于内存的队列系统，适合 Cloudflare Pages 部署
- 支持多种 API 端点：文本生成、图片生成、视频生成等
- 自动清理过期请求，防止内存泄漏

### API 路由

- `POST /api/queue/submit`: 提交请求到队列
- `GET /api/queue/status`: 获取队列状态
- `POST /api/queue/status`: 批量获取状态

### 前端组件

- `QueueStatus`: 显示单个请求的排队状态
- `GlobalQueueStatus`: 显示全局队列状态
- `useQueue`: 处理队列交互的 React Hook

## 故障排除

### 常见问题

1. **队列不工作**
   - 检查环境变量是否正确配置
   - 确认 `NEXT_PUBLIC_APP_URL` 指向正确的域名

2. **请求超时**
   - 检查 API Key 是否有效
   - 确认网络连接正常

3. **状态不更新**
   - 检查浏览器控制台是否有错误
   - 确认轮询请求是否正常

### 日志查看

在 Cloudflare Pages 控制台的 "Functions" 部分可以查看函数日志，帮助调试问题。

## 扩展功能

### 添加新的 API 端点

1. 在 `src/lib/queue.ts` 的 `handleRequest` 方法中添加新的 case
2. 在 `supportedEndpoints` 数组中添加端点名称
3. 创建对应的处理函数

### 自定义排队 UI

修改 `src/components/features/QueueStatus.tsx` 来自定义排队状态的显示样式。

## 性能优化

- 队列系统使用内存存储，适合中等规模的并发
- 自动清理机制防止内存泄漏
- 智能轮询间隔，平衡实时性和性能

## 安全考虑

- 用户 ID 基于 IP 和 User-Agent 生成，确保基本隔离
- 队列项目自动过期，防止长期占用资源
- 支持多种 IP 源检测（Cloudflare、代理等）
