# 测试目录 (Tests Directory)

此目录用于存放项目的所有测试文件。

## 目录结构

```
tests/
├── README.md                  # 本文件 - 测试目录说明
├── clipboard.test.js          # 剪贴板功能测试
├── test-run.js               # 项目运行测试脚本
└── test-video-api.cjs        # 视频 API 测试
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
```

## 添加新测试

当需要添加新的测试时，请：

1. 在 `tests/` 目录下创建测试文件
2. 遵循上述命名规范
3. 在文件顶部添加简短的注释说明测试目的
4. 更新此 README.md 文件的目录结构（如有必要）

## 注意事项

- 测试文件应该包含清晰的测试描述
- 使用有意义的测试名称
- 避免在测试中使用硬编码的值
- 测试应该是独立的，不依赖于其他测试的执行顺序
- 定期清理不再需要的测试文件

---

**保持测试代码的整洁性有助于项目的长期维护和开发效率！**
