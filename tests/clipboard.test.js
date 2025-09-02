/**
 * Clipboard functionality test script
 * Tests the robust clipboard copy functionality in different environments
 */

// Mock browser environment for testing
function createMockEnvironment(options) {
  const config = {
    hasWindow: true,
    hasNavigator: true,
    hasClipboard: true,
    hasWriteText: true,
    hasDocument: true,
    hasExecCommand: true,
    writeTextThrows: false,
    execCommandReturns: true,
    ...options
  };

  const mockEnv = {};

  if (config.hasWindow) {
    mockEnv.window = {};
  }

  if (config.hasNavigator) {
    mockEnv.navigator = {};
    
    if (config.hasClipboard) {
      mockEnv.navigator.clipboard = {};
      
      if (config.hasWriteText) {
        if (config.writeTextThrows) {
          mockEnv.navigator.clipboard.writeText = function() {
            throw new Error('Permission denied');
          };
        } else {
          mockEnv.navigator.clipboard.writeText = function(text) { 
            return Promise.resolve();
          };
        }
      }
    }
  }

  if (config.hasDocument) {
    mockEnv.document = {
      createElement: function(tag) {
        const element = {
          style: {},
          value: '',
          select: function() {},
          setSelectionRange: function() {}
        };
        return element;
      },
      body: {
        appendChild: function() {},
        removeChild: function() {}
      }
    };

    if (config.hasExecCommand) {
      mockEnv.document.execCommand = function() { 
        return config.execCommandReturns;
      };
    }
  }

  return mockEnv;
}

// Copy the robust clipboard function from our component
function createCopyToClipboard(env) {
  return async function(text) {
    // Check if we're in a browser environment
    if (typeof env.window === 'undefined') {
      return { success: false, message: '不支持服务器端复制' };
    }

    // Method 1: Modern Clipboard API
    if (env.navigator && env.navigator.clipboard && env.navigator.clipboard.writeText) {
      try {
        await env.navigator.clipboard.writeText(text);
        return { success: true, message: '复制成功！' };
      } catch (err) {
        console.warn('Clipboard API failed:', err);
        // Fall through to legacy method
      }
    }

    // Method 2: Legacy execCommand fallback
    try {
      // Create a temporary textarea element
      const textarea = env.document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.left = '-9999px';
      
      env.document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, 99999); // For mobile devices
      
      const successful = env.document.execCommand('copy');
      env.document.body.removeChild(textarea);
      
      if (successful) {
        return { success: true, message: '复制成功！' };
      } else {
        return { success: false, message: '复制失败，请手动复制' };
      }
    } catch (err) {
      console.error('Legacy copy method failed:', err);
      return { success: false, message: '复制功能不可用，请手动复制' };
    }
  };
}

// Test cases
async function runTests() {
  console.log('🧪 开始clipboard复制功能测试...\n');
  
  const testCases = [
    {
      name: '✅ 正常浏览器环境 - Clipboard API可用',
      env: createMockEnvironment(),
      expectedSuccess: true,
      expectedMessage: '复制成功！'
    },
    {
      name: '🔄 Clipboard API失败，fallback到execCommand',
      env: createMockEnvironment({ writeTextThrows: true }),
      expectedSuccess: true,
      expectedMessage: '复制成功！'
    },
    {
      name: '🚫 无Clipboard API，使用execCommand',
      env: createMockEnvironment({ hasClipboard: false }),
      expectedSuccess: true,
      expectedMessage: '复制成功！'
    },
    {
      name: '❌ execCommand失败',
      env: createMockEnvironment({ hasClipboard: false, execCommandReturns: false }),
      expectedSuccess: false,
      expectedMessage: '复制失败，请手动复制'
    },
    {
      name: '🖥️ 服务器端环境',
      env: createMockEnvironment({ hasWindow: false }),
      expectedSuccess: false,
      expectedMessage: '不支持服务器端复制'
    },
    {
      name: '🌐 无navigator对象',
      env: createMockEnvironment({ hasNavigator: false }),
      expectedSuccess: true,
      expectedMessage: '复制成功！'
    },
    {
      name: '📄 无document对象',
      env: createMockEnvironment({ hasDocument: false }),
      expectedSuccess: false,
      expectedMessage: '复制功能不可用，请手动复制'
    }
  ];

  let passedTests = 0;
  let totalTests = testCases.length;

  for (const testCase of testCases) {
    try {
      const copyToClipboard = createCopyToClipboard(testCase.env);
      const result = await copyToClipboard('测试文本内容');
      
      const success = result.success === testCase.expectedSuccess && 
                     result.message === testCase.expectedMessage;
      
      if (success) {
        console.log(`✅ ${testCase.name}`);
        console.log(`   结果: ${result.message}`);
        passedTests++;
      } else {
        console.log(`❌ ${testCase.name}`);
        console.log(`   期望: success=${testCase.expectedSuccess}, message="${testCase.expectedMessage}"`);
        console.log(`   实际: success=${result.success}, message="${result.message}"`);
      }
      console.log('');
    } catch (error) {
      console.log(`💥 ${testCase.name} - 测试异常`);
      console.log(`   错误: ${error.message}`);
      console.log('');
    }
  }

  // 测试结果汇总
  console.log('═══════════════════════════════════════');
  console.log(`📊 测试结果汇总:`);
  console.log(`   通过: ${passedTests}/${totalTests}`);
  console.log(`   成功率: ${((passedTests/totalTests) * 100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    console.log('🎉 所有测试通过！复制功能修复成功！');
  } else {
    console.log('⚠️  部分测试失败，需要进一步调试');
  }
  console.log('═══════════════════════════════════════');
}

// 性能测试
async function runPerformanceTests() {
  console.log('\n⚡ 开始性能测试...\n');
  
  const env = createMockEnvironment();
  const copyToClipboard = createCopyToClipboard(env);
  const testText = 'A'.repeat(1000); // 1KB text
  
  const iterations = 100;
  const times = [];
  
  // Use Date.now() for better compatibility
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await copyToClipboard(testText);
    const end = Date.now();
    times.push(end - start);
  }
  
  const avgTime = times.reduce((a, b) => a + b) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  
  console.log(`📈 性能测试结果 (${iterations}次测试):`);
  console.log(`   平均时间: ${avgTime.toFixed(3)}ms`);
  console.log(`   最短时间: ${minTime.toFixed(3)}ms`);
  console.log(`   最长时间: ${maxTime.toFixed(3)}ms`);
  console.log(`   文本大小: 1KB`);
}

// 环境检测测试
function runEnvironmentDetectionTests() {
  console.log('\n🔍 环境检测测试...\n');
  
  const environments = [
    {
      name: '现代浏览器',
      env: createMockEnvironment()
    },
    {
      name: '旧版浏览器',
      env: createMockEnvironment({ hasClipboard: false })
    },
    {
      name: '受限环境',
      env: createMockEnvironment({ hasClipboard: false, hasExecCommand: false })
    },
    {
      name: '服务器环境',
      env: createMockEnvironment({ hasWindow: false })
    }
  ];
  
  environments.forEach(function({ name, env }) {
    console.log(`🖥️  ${name}:`);
    console.log(`   浏览器环境: ${typeof env.window !== 'undefined' ? '✓' : '✗'}`);
    console.log(`   navigator: ${typeof env.navigator !== 'undefined' ? '✓' : '✗'}`);
    console.log(`   clipboard API: ${env.navigator && env.navigator.clipboard ? '✓' : '✗'}`);
    console.log(`   writeText: ${env.navigator && env.navigator.clipboard && env.navigator.clipboard.writeText ? '✓' : '✗'}`);
    console.log(`   document: ${typeof env.document !== 'undefined' ? '✓' : '✗'}`);
    console.log(`   execCommand: ${env.document && typeof env.document.execCommand === 'function' ? '✓' : '✗'}`);
    console.log('');
  });
}

// Main execution
async function main() {
  console.log('🚀 Clipboard功能测试套件');
  console.log('════════════════════════════════════════════════════\n');
  
  try {
    await runTests();
    runEnvironmentDetectionTests();
    await runPerformanceTests();
    
    console.log('\n✨ 测试完成！');
  } catch (error) {
    console.error('💥 测试执行失败:', error);
  }
}

// Run if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  main();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createMockEnvironment,
    createCopyToClipboard,
    runTests,
    runPerformanceTests,
    runEnvironmentDetectionTests,
    main
  };
}
