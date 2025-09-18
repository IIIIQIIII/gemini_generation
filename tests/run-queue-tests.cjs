/**
 * 排队系统测试运行器
 * 自动运行所有排队系统相关测试
 */

const { spawn } = require('child_process');
const path = require('path');

const TESTS = [
  {
    name: '基础功能测试',
    file: 'test-queue-basic.cjs',
    description: '验证排队系统的基本功能，包括提交、查询、状态检查等'
  },
  {
    name: '完整功能测试',
    file: 'test-queue-system.cjs',
    description: '全面测试排队系统的所有功能，包括并发处理、轮询、错误处理等'
  },
  {
    name: '性能测试',
    file: 'test-queue-performance.cjs',
    description: '测试高并发情况下的系统性能和稳定性'
  }
];

function runTest(testFile) {
  return new Promise((resolve, reject) => {
    const testPath = path.join(__dirname, testFile);
    console.log(`\n🚀 开始运行: ${testFile}`);
    console.log('─'.repeat(60));
    
    const child = spawn('node', [testPath], {
      stdio: 'inherit',
      cwd: __dirname
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✅ ${testFile} 测试完成`);
        resolve({ success: true, code });
      } else {
        console.log(`\n❌ ${testFile} 测试失败 (退出码: ${code})`);
        resolve({ success: false, code });
      }
    });

    child.on('error', (error) => {
      console.log(`\n❌ ${testFile} 执行错误: ${error.message}`);
      reject(error);
    });
  });
}

async function runAllTests() {
  console.log('🎯 排队系统测试套件');
  console.log('═══════════════════════════════════════');
  console.log('本测试套件将验证排队系统的以下功能：');
  console.log('• 基本的队列提交和状态查询');
  console.log('• 并发请求处理和轮询机制');
  console.log('• 错误处理和边界情况');
  console.log('• 高并发下的系统性能');
  console.log('• 队列管理和资源清理');
  console.log('═══════════════════════════════════════');
  
  console.log('\n📋 可用测试:');
  TESTS.forEach((test, index) => {
    console.log(`   ${index + 1}. ${test.name}`);
    console.log(`      ${test.description}`);
  });

  const results = [];
  const startTime = Date.now();

  // 依次运行所有测试
  for (const test of TESTS) {
    try {
      const result = await runTest(test.file);
      results.push({
        name: test.name,
        file: test.file,
        ...result
      });
    } catch (error) {
      console.error(`❌ 测试 ${test.name} 执行失败:`, error.message);
      results.push({
        name: test.name,
        file: test.file,
        success: false,
        error: error.message
      });
    }
  }

  // 生成测试报告
  const totalTime = Date.now() - startTime;
  
  console.log('\n═══════════════════════════════════════');
  console.log('📊 测试报告');
  console.log('═══════════════════════════════════════');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`总测试数: ${results.length}`);
  console.log(`通过: ${successful.length}`);
  console.log(`失败: ${failed.length}`);
  console.log(`成功率: ${Math.round((successful.length / results.length) * 100)}%`);
  console.log(`总耗时: ${Math.round(totalTime / 1000)} 秒`);
  
  console.log('\n📋 详细结果:');
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    const time = result.code !== undefined ? `(退出码: ${result.code})` : '';
    const error = result.error ? ` - ${result.error}` : '';
    console.log(`   ${index + 1}. ${status} ${result.name} ${time}${error}`);
  });

  if (failed.length > 0) {
    console.log('\n❌ 失败的测试:');
    failed.forEach(result => {
      console.log(`   • ${result.name}: ${result.error || `退出码 ${result.code}`}`);
    });
  }

  console.log('\n💡 使用说明:');
  console.log('1. 确保服务器正在运行: npm run dev');
  console.log('2. 基础测试: node tests/test-queue-basic.cjs');
  console.log('3. 完整测试: node tests/test-queue-system.cjs');
  console.log('4. 性能测试: node tests/test-queue-performance.cjs');
  console.log('5. 运行所有测试: node tests/run-queue-tests.cjs');

  console.log('\n🔧 故障排除:');
  console.log('• 如果测试失败，请检查服务器是否正常运行');
  console.log('• 确保排队系统已正确部署到服务器');
  console.log('• 检查网络连接和端口占用情况');
  console.log('• 查看服务器日志了解详细错误信息');

  // 返回总体结果
  if (failed.length === 0) {
    console.log('\n🎉 所有测试通过！排队系统工作正常');
    process.exit(0);
  } else {
    console.log('\n⚠️ 部分测试失败，请检查排队系统配置');
    process.exit(1);
  }
}

// 检查命令行参数
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log('排队系统测试运行器');
  console.log('\n用法:');
  console.log('  node tests/run-queue-tests.cjs [选项]');
  console.log('\n选项:');
  console.log('  --help, -h     显示帮助信息');
  console.log('  --basic        只运行基础测试');
  console.log('  --full         只运行完整测试');
  console.log('  --performance  只运行性能测试');
  console.log('\n示例:');
  console.log('  node tests/run-queue-tests.cjs --basic');
  console.log('  node tests/run-queue-tests.cjs --performance');
  process.exit(0);
}

if (args.includes('--basic')) {
  runTest('test-queue-basic.cjs').then(() => process.exit(0)).catch(() => process.exit(1));
} else if (args.includes('--full')) {
  runTest('test-queue-system.cjs').then(() => process.exit(0)).catch(() => process.exit(1));
} else if (args.includes('--performance')) {
  runTest('test-queue-performance.cjs').then(() => process.exit(0)).catch(() => process.exit(1));
} else {
  // 运行所有测试
  runAllTests().catch((error) => {
    console.error('❌ 测试运行器错误:', error.message);
    process.exit(1);
  });
}
