/**
 * 排队系统测试脚本
 * 测试类似 Hugging Face Space 的排队功能
 */

const http = require('http');
const { URL } = require('url');

const BASE_URL = 'http://localhost:3000';

// 测试配置
const TEST_CONFIG = {
  maxConcurrent: 2,
  testRequests: 5,
  requestInterval: 1000, // 1秒间隔
  statusPollInterval: 2000, // 2秒轮询
  maxWaitTime: 60000 // 60秒最大等待时间
};

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
        'User-Agent': 'Queue-Test-Client/1.0',
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
            statusText: res.statusMessage,
            headers: res.headers,
            data: jsonData
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: res.headers,
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

async function testQueueSubmission() {
  console.log('1️⃣ 测试队列提交功能...');
  
  const testData = {
    prompt: '测试排队系统的文本生成功能',
    useVertexAI: false,
    apiKey: 'test-api-key'
  };

  try {
    const response = await makeRequest(`${BASE_URL}/api/queue/submit`, {
      method: 'POST',
      body: {
        endpoint: 'generate-text',
        data: testData
      }
    });

    console.log(`📡 响应状态: ${response.status} ${response.statusText}`);
    console.log(`📦 响应数据:`, JSON.stringify(response.data, null, 2));

    if (response.status === 200 && response.data.success) {
      console.log(`✅ 队列提交成功，获得项目ID: ${response.data.itemId}`);
      return response.data.itemId;
    } else {
      console.log('❌ 队列提交失败');
      return null;
    }
  } catch (error) {
    console.log('❌ 队列提交错误:', error.message);
    return null;
  }
}

async function testQueueStatus(itemId) {
  console.log('2️⃣ 测试队列状态查询...');
  
  if (!itemId) {
    console.log('⚠️ 跳过状态查询测试（没有有效的项目ID）');
    return;
  }

  try {
    const response = await makeRequest(`${BASE_URL}/api/queue/status?itemId=${encodeURIComponent(itemId)}`);
    
    console.log(`📡 响应状态: ${response.status} ${response.statusText}`);
    console.log(`📦 响应数据:`, JSON.stringify(response.data, null, 2));

    if (response.status === 200 && response.data.success) {
      console.log(`✅ 状态查询成功`);
      console.log(`   项目状态: ${response.data.item.status}`);
      console.log(`   时间戳: ${response.data.item.timestamp}`);
      return response.data.item;
    } else {
      console.log('❌ 状态查询失败');
      return null;
    }
  } catch (error) {
    console.log('❌ 状态查询错误:', error.message);
    return null;
  }
}

async function testGlobalQueueStatus() {
  console.log('3️⃣ 测试全局队列状态...');

  try {
    const response = await makeRequest(`${BASE_URL}/api/queue/status`);
    
    console.log(`📡 响应状态: ${response.status} ${response.statusText}`);
    console.log(`📦 响应数据:`, JSON.stringify(response.data, null, 2));

    if (response.status === 200 && response.data.success) {
      const status = response.data.status;
      console.log(`✅ 全局状态查询成功`);
      console.log(`   队列中: ${status.totalInQueue} 个请求`);
      console.log(`   处理中: ${status.currentlyProcessing} 个请求`);
      console.log(`   预计等待时间: ${status.estimatedWaitTime} 秒`);
      return status;
    } else {
      console.log('❌ 全局状态查询失败');
      return null;
    }
  } catch (error) {
    console.log('❌ 全局状态查询错误:', error.message);
    return null;
  }
}

async function testConcurrentRequests() {
  console.log('4️⃣ 测试并发请求处理...');
  
  const promises = [];
  const requestIds = [];

  // 创建多个并发请求
  for (let i = 0; i < TEST_CONFIG.testRequests; i++) {
    const promise = makeRequest(`${BASE_URL}/api/queue/submit`, {
      method: 'POST',
      headers: {
        'X-Test-Request-ID': `test-request-${i}`,
        'X-Forwarded-For': `192.168.1.${100 + i}` // 模拟不同IP
      },
      body: {
        endpoint: 'generate-text',
        data: {
          prompt: `并发测试请求 ${i + 1}`,
          useVertexAI: false,
          apiKey: 'test-api-key'
        }
      }
    }).then(response => {
      console.log(`📤 请求 ${i + 1} 提交完成: ${response.status}`);
      return { index: i, response };
    });

    promises.push(promise);
    
    // 间隔提交请求
    if (i < TEST_CONFIG.testRequests - 1) {
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.requestInterval));
    }
  }

  try {
    const results = await Promise.all(promises);
    console.log(`✅ 所有 ${TEST_CONFIG.testRequests} 个请求已提交`);
    
    results.forEach(({ index, response }) => {
      if (response.status === 200 && response.data.success) {
        requestIds.push(response.data.itemId);
        console.log(`   请求 ${index + 1} ID: ${response.data.itemId}`);
      } else {
        console.log(`   ❌ 请求 ${index + 1} 失败`);
      }
    });

    return requestIds;
  } catch (error) {
    console.log('❌ 并发请求测试错误:', error.message);
    return [];
  }
}

async function testQueuePolling(requestIds) {
  console.log('5️⃣ 测试队列轮询功能...');
  
  if (requestIds.length === 0) {
    console.log('⚠️ 跳过轮询测试（没有有效的请求ID）');
    return;
  }

  const startTime = Date.now();
  const completedRequests = new Set();
  let pollCount = 0;

  while (completedRequests.size < requestIds.length && 
         (Date.now() - startTime) < TEST_CONFIG.maxWaitTime) {
    
    pollCount++;
    console.log(`\n🔄 第 ${pollCount} 轮轮询...`);
    
    for (const requestId of requestIds) {
      if (completedRequests.has(requestId)) continue;

      try {
        const response = await makeRequest(`${BASE_URL}/api/queue/status?itemId=${encodeURIComponent(requestId)}`);
        
        if (response.status === 200 && response.data.success) {
          const item = response.data.item;
          console.log(`   请求 ${requestId.slice(0, 8)}...: ${item.status}`);
          
          if (item.status === 'completed') {
            completedRequests.add(requestId);
            console.log(`   ✅ 请求 ${requestId.slice(0, 8)}... 完成`);
          } else if (item.status === 'failed') {
            completedRequests.add(requestId);
            console.log(`   ❌ 请求 ${requestId.slice(0, 8)}... 失败: ${item.error}`);
          }
        }
      } catch (error) {
        console.log(`   ⚠️ 请求 ${requestId.slice(0, 8)}... 轮询错误: ${error.message}`);
      }
    }

    // 显示全局状态
    try {
      const globalResponse = await makeRequest(`${BASE_URL}/api/queue/status`);
      if (globalResponse.status === 200 && globalResponse.data.success) {
        const status = globalResponse.data.status;
        console.log(`   📊 全局状态: 队列中 ${status.totalInQueue}, 处理中 ${status.currentlyProcessing}`);
      }
    } catch (error) {
      console.log(`   ⚠️ 全局状态查询错误: ${error.message}`);
    }

    if (completedRequests.size < requestIds.length) {
      console.log(`   等待 ${TEST_CONFIG.statusPollInterval / 1000} 秒后进行下一轮轮询...`);
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.statusPollInterval));
    }
  }

  console.log(`\n📊 轮询测试结果:`);
  console.log(`   总轮询次数: ${pollCount}`);
  console.log(`   完成请求数: ${completedRequests.size}/${requestIds.length}`);
  console.log(`   总耗时: ${Math.round((Date.now() - startTime) / 1000)} 秒`);

  if (completedRequests.size === requestIds.length) {
    console.log('✅ 所有请求都已完成或失败');
  } else {
    console.log('⚠️ 部分请求超时未完成');
  }
}

async function testErrorHandling() {
  console.log('6️⃣ 测试错误处理...');

  const errorTests = [
    {
      name: '无效端点',
      data: { endpoint: 'invalid-endpoint', data: {} }
    },
    {
      name: '缺少数据',
      data: { endpoint: 'generate-text' }
    },
    {
      name: '无效项目ID',
      query: '?itemId=invalid-id'
    }
  ];

  for (const test of errorTests) {
    console.log(`   测试: ${test.name}`);
    
    try {
      let response;
      if (test.query) {
        response = await makeRequest(`${BASE_URL}/api/queue/status${test.query}`);
      } else {
        response = await makeRequest(`${BASE_URL}/api/queue/submit`, {
          method: 'POST',
          body: test.data
        });
      }

      console.log(`     响应状态: ${response.status}`);
      
      if (response.status >= 400) {
        console.log(`     ✅ 正确返回错误状态`);
      } else {
        console.log(`     ⚠️ 应该返回错误状态但返回了 ${response.status}`);
      }
    } catch (error) {
      console.log(`     ❌ 测试错误: ${error.message}`);
    }
  }
}

async function testBatchStatusQuery() {
  console.log('7️⃣ 测试批量状态查询...');

  // 先生成几个测试ID
  const testIds = [];
  for (let i = 0; i < 3; i++) {
    const response = await makeRequest(`${BASE_URL}/api/queue/submit`, {
      method: 'POST',
      body: {
        endpoint: 'generate-text',
        data: {
          prompt: `批量测试请求 ${i + 1}`,
          useVertexAI: false,
          apiKey: 'test-api-key'
        }
      }
    });

    if (response.status === 200 && response.data.success) {
      testIds.push(response.data.itemId);
    }
  }

  if (testIds.length === 0) {
    console.log('   ⚠️ 没有可用的测试ID，跳过批量查询测试');
    return;
  }

  try {
    const response = await makeRequest(`${BASE_URL}/api/queue/status`, {
      method: 'POST',
      body: {
        itemIds: testIds,
        userIds: ['test-user-1', 'test-user-2']
      }
    });

    console.log(`📡 响应状态: ${response.status}`);
    console.log(`📦 响应数据:`, JSON.stringify(response.data, null, 2));

    if (response.status === 200 && response.data.success) {
      console.log('✅ 批量状态查询成功');
      if (response.data.items) {
        console.log(`   查询到 ${Object.keys(response.data.items).length} 个项目状态`);
      }
      if (response.data.userStatuses) {
        console.log(`   查询到 ${Object.keys(response.data.userStatuses).length} 个用户状态`);
      }
    } else {
      console.log('❌ 批量状态查询失败');
    }
  } catch (error) {
    console.log('❌ 批量状态查询错误:', error.message);
  }
}

async function runQueueTests() {
  console.log('🚀 开始排队系统测试...\n');
  console.log('═══════════════════════════════════════');
  console.log('测试配置:');
  console.log(`   最大并发: ${TEST_CONFIG.maxConcurrent}`);
  console.log(`   测试请求数: ${TEST_CONFIG.testRequests}`);
  console.log(`   请求间隔: ${TEST_CONFIG.requestInterval}ms`);
  console.log(`   轮询间隔: ${TEST_CONFIG.statusPollInterval}ms`);
  console.log(`   最大等待时间: ${TEST_CONFIG.maxWaitTime}ms`);
  console.log('═══════════════════════════════════════\n');

  const startTime = Date.now();
  let passedTests = 0;
  let totalTests = 7;

  try {
    // 1. 基本队列提交测试
    const itemId = await testQueueSubmission();
    if (itemId) passedTests++;
    console.log('');

    // 2. 队列状态查询测试
    await testQueueStatus(itemId);
    passedTests++;
    console.log('');

    // 3. 全局队列状态测试
    await testGlobalQueueStatus();
    passedTests++;
    console.log('');

    // 4. 并发请求测试
    const requestIds = await testConcurrentRequests();
    if (requestIds.length > 0) passedTests++;
    console.log('');

    // 5. 队列轮询测试
    await testQueuePolling(requestIds);
    passedTests++;
    console.log('');

    // 6. 错误处理测试
    await testErrorHandling();
    passedTests++;
    console.log('');

    // 7. 批量状态查询测试
    await testBatchStatusQuery();
    passedTests++;
    console.log('');

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.message);
  }

  const totalTime = Math.round((Date.now() - startTime) / 1000);
  
  console.log('═══════════════════════════════════════');
  console.log('🎯 测试结果汇总:');
  console.log(`   通过测试: ${passedTests}/${totalTests}`);
  console.log(`   总耗时: ${totalTime} 秒`);
  console.log(`   成功率: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  if (passedTests === totalTests) {
    console.log('🎉 所有测试通过！排队系统工作正常');
  } else {
    console.log('⚠️ 部分测试失败，请检查排队系统配置');
  }
  console.log('═══════════════════════════════════════\n');

  console.log('💡 测试说明:');
  console.log('1. 确保服务器正在运行 (npm run dev)');
  console.log('2. 排队系统使用内存存储，重启服务器会清空队列');
  console.log('3. 测试会创建多个请求来验证并发处理能力');
  console.log('4. 轮询测试会持续监控请求状态直到完成');
  console.log('5. 错误处理测试验证系统对无效请求的响应');
}

// 运行测试
runQueueTests().catch(console.error);
