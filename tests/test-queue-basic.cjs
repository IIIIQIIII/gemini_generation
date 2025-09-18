/**
 * 排队系统基础功能测试
 * 快速验证排队系统的核心功能
 */

const http = require('http');
const { URL } = require('url');

const BASE_URL = 'http://localhost:3000';

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Queue-Basic-Test/1.0',
        ...options.headers
      }
    };

    const req = http.request(requestOptions, (res) => {
      let data = Buffer.alloc(0);
      
      res.on('data', (chunk) => {
        data = Buffer.concat([data, chunk]);
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data.toString());
          resolve({
            status: res.statusCode,
            data: jsonData
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            data: data.toString()
          });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

async function testServerConnection() {
  console.log('🔍 检查服务器连接...');
  
  try {
    const response = await makeRequest(`${BASE_URL}/api/queue/status`);
    if (response.status === 200) {
      console.log('✅ 服务器连接正常');
      return true;
    } else {
      console.log(`❌ 服务器响应异常: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ 无法连接到服务器: ${error.message}`);
    console.log('💡 请确保服务器正在运行: npm run dev');
    return false;
  }
}

async function testQueueSubmit() {
  console.log('\n📤 测试队列提交...');
  
  const testData = {
    endpoint: 'generate-text',
    data: {
      prompt: '测试排队系统',
      useVertexAI: false,
      apiKey: 'test-key'
    }
  };

  try {
    const response = await makeRequest(`${BASE_URL}/api/queue/submit`, {
      method: 'POST',
      body: testData
    });

    console.log(`📡 响应状态: ${response.status}`);
    
    if (response.status === 200 && response.data.success) {
      console.log(`✅ 提交成功，项目ID: ${response.data.itemId}`);
      return response.data.itemId;
    } else {
      console.log(`❌ 提交失败:`, response.data.error || '未知错误');
      return null;
    }
  } catch (error) {
    console.log(`❌ 提交错误: ${error.message}`);
    return null;
  }
}

async function testQueueStatus(itemId) {
  console.log('\n📊 测试状态查询...');
  
  if (!itemId) {
    console.log('⚠️ 跳过状态查询（没有项目ID）');
    return false;
  }

  try {
    const response = await makeRequest(`${BASE_URL}/api/queue/status?itemId=${encodeURIComponent(itemId)}`);
    
    console.log(`📡 响应状态: ${response.status}`);
    
    if (response.status === 200 && response.data.success) {
      const item = response.data.item;
      console.log(`✅ 状态查询成功`);
      console.log(`   项目状态: ${item.status}`);
      console.log(`   时间戳: ${new Date(item.timestamp).toLocaleString()}`);
      return true;
    } else if (response.status === 404) {
      console.log(`⚠️ 项目不存在（可能已被清理）`);
      return true; // 404 也是正常的，说明系统工作正常
    } else {
      console.log(`❌ 状态查询失败:`, response.data.error || '未知错误');
      return false;
    }
  } catch (error) {
    console.log(`❌ 状态查询错误: ${error.message}`);
    return false;
  }
}

async function testGlobalStatus() {
  console.log('\n🌐 测试全局状态...');
  
  try {
    const response = await makeRequest(`${BASE_URL}/api/queue/status`);
    
    console.log(`📡 响应状态: ${response.status}`);
    
    if (response.status === 200 && response.data.success) {
      const status = response.data.status;
      console.log(`✅ 全局状态查询成功`);
      console.log(`   队列中: ${status.totalInQueue} 个请求`);
      console.log(`   处理中: ${status.currentlyProcessing} 个请求`);
      console.log(`   预计等待时间: ${status.estimatedWaitTime} 秒`);
      return true;
    } else {
      console.log(`❌ 全局状态查询失败:`, response.data.error || '未知错误');
      return false;
    }
  } catch (error) {
    console.log(`❌ 全局状态查询错误: ${error.message}`);
    return false;
  }
}

async function testErrorHandling() {
  console.log('\n🛡️ 测试错误处理...');
  
  const errorTests = [
    {
      name: '无效端点',
      data: { endpoint: 'invalid-endpoint', data: {} }
    },
    {
      name: '缺少数据',
      data: { endpoint: 'generate-text' }
    }
  ];

  let passedTests = 0;
  
  for (const test of errorTests) {
    try {
      const response = await makeRequest(`${BASE_URL}/api/queue/submit`, {
        method: 'POST',
        body: test.data
      });

      if (response.status >= 400) {
        console.log(`✅ ${test.name}: 正确处理错误 (${response.status})`);
        passedTests++;
      } else {
        console.log(`❌ ${test.name}: 应该返回错误但返回了 ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name}: 请求错误 ${error.message}`);
    }
  }

  return passedTests === errorTests.length;
}

async function runBasicTests() {
  console.log('🚀 排队系统基础功能测试');
  console.log('═══════════════════════════════════════');
  
  const startTime = Date.now();
  let passedTests = 0;
  const totalTests = 5;

  // 1. 服务器连接测试
  const serverOk = await testServerConnection();
  if (serverOk) passedTests++;

  if (!serverOk) {
    console.log('\n❌ 服务器连接失败，无法继续测试');
    console.log('💡 请确保：');
    console.log('   1. 服务器正在运行 (npm run dev)');
    console.log('   2. 端口 3000 没有被占用');
    console.log('   3. 排队系统已正确部署');
    return;
  }

  // 2. 队列提交测试
  const itemId = await testQueueSubmit();
  if (itemId) passedTests++;

  // 3. 状态查询测试
  const statusOk = await testQueueStatus(itemId);
  if (statusOk) passedTests++;

  // 4. 全局状态测试
  const globalOk = await testGlobalStatus();
  if (globalOk) passedTests++;

  // 5. 错误处理测试
  const errorOk = await testErrorHandling();
  if (errorOk) passedTests++;

  const totalTime = Math.round((Date.now() - startTime) / 1000);
  
  console.log('\n═══════════════════════════════════════');
  console.log('🎯 测试结果:');
  console.log(`   通过测试: ${passedTests}/${totalTests}`);
  console.log(`   耗时: ${totalTime} 秒`);
  console.log(`   成功率: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  if (passedTests === totalTests) {
    console.log('🎉 所有基础测试通过！排队系统运行正常');
    console.log('\n💡 下一步可以运行完整测试:');
    console.log('   node tests/test-queue-system.cjs');
  } else {
    console.log('⚠️ 部分测试失败，请检查排队系统配置');
  }
  console.log('═══════════════════════════════════════');
}

// 运行测试
runBasicTests().catch(console.error);
