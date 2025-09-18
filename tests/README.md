# 测试目录 (Tests Directory)

此目录用于存放项目的所有测试文件。

## 目录结构

```
tests/
├── README.md                     # 本文件 - 测试目录说明
├── clipboard.test.js             # 剪贴板功能测试
├── test-run.js                  # 项目运行测试脚本
├── test-video-api.cjs           # 视频 API 测试
├── test-speech.cjs              # 语音合成测试
├── test-queue-basic.cjs         # 排队系统基础测试
├── test-queue-system.cjs        # 排队系统完整测试
├── test-queue-performance.cjs   # 排队系统性能测试
└── run-queue-tests.cjs          # 排队系统测试运行器
```

## 测试文件命名规范

为了保持项目的整洁性和可维护性，请遵循以下规范：

### 1. 测试文件位置
- **所有测试文件必须放在 `tests/` 目录下**
- 不要在项目根目录下创建测试文件

### 2. 命名规范
- **单元测试**: `*.test.js` 或 `*.spec.js`
  - 例如: `clipboard.test.js`, `api.test.js`
- **功能测试**: `test-*.js`
  - 例如: `test-run.js`, `test-video-api.cjs`
- **集成测试**: `integration-*.test.js`
  - 例如: `integration-auth.test.js`

### 3. 文件类型
- JavaScript 测试: `.js`
- TypeScript 测试: `.ts`
- CommonJS 模块: `.cjs`
- ES 模块: `.mjs`

## 测试类型说明

### 单元测试 (Unit Tests)
测试单个组件或函数的功能，使用 `*.test.js` 命名：
```javascript
// clipboard.test.js
describe('Clipboard functionality', () => {
  test('should copy text to clipboard', () => {
    // 测试代码
  });
});
```

### 功能测试 (Functional Tests)
测试特定功能或 API 的集成测试，使用 `test-*.js` 命名：
```javascript
// test-video-api.cjs
// 测试视频 API 的完整流程
```

### 运行脚本 (Test Runners)
用于启动和运行各种测试的脚本：
```javascript
// test-run.js
// 项目测试运行脚本
```

## 运行测试

根据项目配置，可以使用以下命令运行测试：

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test tests/clipboard.test.js

# 运行功能测试脚本
node tests/test-run.js

# 运行 API 测试
node tests/test-video-api.cjs

# 运行排队系统测试
node tests/test-queue-basic.cjs        # 基础功能测试
node tests/test-queue-system.cjs       # 完整功能测试
node tests/test-queue-performance.cjs  # 性能测试
node tests/run-queue-tests.cjs         # 运行所有排队测试
```

## 添加新测试

当需要添加新的测试时，请：

1. 在 `tests/` 目录下创建测试文件
2. 遵循上述命名规范
3. 在文件顶部添加简短的注释说明测试目的
4. 更新此 README.md 文件的目录结构（如有必要）

## 排队系统测试

### 测试概述
排队系统测试用于验证类似 Hugging Face Space 的排队功能，确保多用户同时使用时的系统稳定性。

### 测试文件说明

#### 1. 基础功能测试 (`test-queue-basic.cjs`)
- **目的**: 快速验证排队系统的基本功能
- **测试内容**: 服务器连接、队列提交、状态查询、错误处理
- **运行时间**: 约 10-30 秒
- **适用场景**: 快速验证系统是否正常工作

#### 2. 完整功能测试 (`test-queue-system.cjs`)
- **目的**: 全面测试排队系统的所有功能
- **测试内容**: 并发请求、轮询机制、批量查询、边界情况
- **运行时间**: 约 2-5 分钟
- **适用场景**: 功能验证和集成测试

#### 3. 性能测试 (`test-queue-performance.cjs`)
- **目的**: 测试高并发情况下的系统性能
- **测试内容**: 大量并发请求、性能指标分析、负载测试
- **运行时间**: 约 3-10 分钟
- **适用场景**: 性能评估和压力测试

#### 4. 测试运行器 (`run-queue-tests.cjs`)
- **目的**: 自动运行所有排队系统测试
- **功能**: 批量测试、结果汇总、报告生成
- **使用方式**: `node tests/run-queue-tests.cjs [选项]`

### 测试前提条件

1. **服务器运行**: 确保开发服务器正在运行 (`npm run dev`)
2. **排队系统部署**: 确保排队系统已正确部署到服务器
3. **网络连接**: 确保能够访问 `http://localhost:3000`
4. **端口可用**: 确保端口 3000 没有被其他程序占用

### 测试命令

```bash
# 快速验证系统是否正常
node tests/test-queue-basic.cjs

# 完整功能测试
node tests/test-queue-system.cjs

# 性能压力测试
node tests/test-queue-performance.cjs

# 运行所有测试
node tests/run-queue-tests.cjs

# 只运行特定测试
node tests/run-queue-tests.cjs --basic
node tests/run-queue-tests.cjs --performance
```

### 测试结果解读

#### 基础测试结果
- ✅ **通过**: 系统基本功能正常
- ❌ **失败**: 需要检查服务器配置或排队系统部署

#### 完整测试结果
- **成功率 100%**: 系统功能完整，可以投入使用
- **成功率 80-99%**: 系统基本正常，可能存在小问题
- **成功率 <80%**: 系统存在问题，需要修复

#### 性能测试结果
- **稳定性**: 评估系统在高并发下的稳定性
- **队列管理**: 评估队列长度控制和资源管理
- **处理时间**: 评估请求处理效率

### 故障排除

#### 常见问题
1. **服务器连接失败**
   - 检查服务器是否运行: `npm run dev`
   - 检查端口占用: `lsof -i :3000`

2. **队列提交失败**
   - 检查排队系统是否正确部署
   - 查看服务器日志了解错误详情

3. **状态查询超时**
   - 检查网络连接稳定性
   - 调整测试配置中的超时时间

4. **性能测试失败**
   - 降低并发请求数量
   - 增加等待时间配置
   - 检查服务器资源使用情况

## 注意事项

- 测试文件应该包含清晰的测试描述
- 使用有意义的测试名称
- 避免在测试中使用硬编码的值
- 测试应该是独立的，不依赖于其他测试的执行顺序
- 定期清理不再需要的测试文件
- 排队系统测试会创建实际的请求，请确保在测试环境中运行

---

**保持测试代码的整洁性有助于项目的长期维护和开发效率！**
