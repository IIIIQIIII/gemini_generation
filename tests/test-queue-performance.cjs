/**
 * 排队系统性能测试
 * 测试高并发情况下的系统表现
 */

const http = require('http');
const { URL } = require('url');

const BASE_URL = 'http://localhost:3000';

// 性能测试配置
const PERFORMANCE_CONFIG = {
  concurrentRequests: 10, // 并发请求数
  requestBatchSize: 5,    // 每批请求数
  batchInterval: 500,     // 批次间隔 (ms)
  maxWaitTime: 120000,    // 最大等待时间 (ms)
  statusPollInterval: 1000 // 状态轮询间隔 (ms)
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
        'User-Agent': 'Queue-Performance-Test/1.0',
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
            data: jsonData,
            responseTime: Date.now() - options.startTime
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            data: data.toString(),
            responseTime: Date.now() - options.startTime
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

async function createTestRequest(index) {
  const startTime = Date.now();
  
  return makeRequest(`${BASE_URL}/api/queue/submit`, {
    method: 'POST',
    startTime,
    headers: {
      'X-Test-Request-ID': `perf-test-${index}`,
      'X-Forwarded-For': `192.168.${Math.floor(index / 255)}.${index % 255}`
    },
    body: {
      endpoint: 'generate-text',
      data: {
        prompt: `性能测试请求 ${index} - 这是一个用于测试排队系统性能的请求`,
        useVertexAI: false,
        apiKey: 'performance-test-key'
      }
    }
  });
}

async function batchSubmitRequests(batchNumber, batchSize) {
  console.log(`📤 提交第 ${batchNumber} 批请求 (${batchSize} 个)...`);
  
  const promises = [];
  const startIndex = (batchNumber - 1) * batchSize;
  
  for (let i = 0; i < batchSize; i++) {
    const index = startIndex + i + 1;
    promises.push(createTestRequest(index));
  }

  const startTime = Date.now();
  const results = await Promise.all(promises);
  const batchTime = Date.now() - startTime;

  const successful = results.filter(r => r.status === 200 && r.data.success);
  const failed = results.filter(r => r.status !== 200 || !r.data.success);
  
  console.log(`   ✅ 成功: ${successful.length}, ❌ 失败: ${failed.length}, ⏱️ 耗时: ${batchTime}ms`);
  
  if (failed.length > 0) {
    console.log('   失败详情:');
    failed.forEach((result, i) => {
      console.log(`     ${i + 1}. 状态: ${result.status}, 错误: ${result.data.error || '未知'}`);
    });
  }

  return successful.map(r => r.data.itemId);
}

async function monitorQueuePerformance(requestIds) {
  console.log(`\n📊 开始监控 ${requestIds.length} 个请求的性能...`);
  
  const startTime = Date.now();
  const completedRequests = new Map(); // itemId -> completionTime
  const requestStatuses = new Map();   // itemId -> status history
  
  let pollCount = 0;
  let maxQueueLength = 0;
  let maxProcessingCount = 0;

  while (completedRequests.size < requestIds.length && 
         (Date.now() - startTime) < PERFORMANCE_CONFIG.maxWaitTime) {
    
    pollCount++;
    const pollStartTime = Date.now();
    
    // 批量查询状态
    const statusPromises = requestIds.map(async (requestId) => {
      if (completedRequests.has(requestId)) return null;
      
      try {
        const response = await makeRequest(`${BASE_URL}/api/queue/status?itemId=${encodeURIComponent(requestId)}`);
        
        if (response.status === 200 && response.data.success) {
          const item = response.data.item;
          
          // 记录状态历史
          if (!requestStatuses.has(requestId)) {
            requestStatuses.set(requestId, []);
          }
          requestStatuses.get(requestId).push({
            status: item.status,
            timestamp: Date.now()
          });
          
          if (item.status === 'completed' || item.status === 'failed') {
            completedRequests.set(requestId, Date.now());
            return { id: requestId, status: item.status, completed: true };
          }
          
          return { id: requestId, status: item.status, completed: false };
        }
      } catch (error) {
        console.log(`   ⚠️ 请求 ${requestId.slice(0, 8)}... 查询错误: ${error.message}`);
      }
      
      return null;
    });

    const statusResults = (await Promise.all(statusPromises)).filter(Boolean);
    
    // 获取全局状态
    let globalStatus = null;
    try {
      const globalResponse = await makeRequest(`${BASE_URL}/api/queue/status`);
      if (globalResponse.status === 200 && globalResponse.data.success) {
        globalStatus = globalResponse.data.status;
        maxQueueLength = Math.max(maxQueueLength, globalStatus.totalInQueue);
        maxProcessingCount = Math.max(maxProcessingCount, globalStatus.currentlyProcessing);
      }
    } catch (error) {
      console.log(`   ⚠️ 全局状态查询错误: ${error.message}`);
    }

    const pollTime = Date.now() - pollStartTime;
    const completedCount = completedRequests.size;
    const remainingCount = requestIds.length - completedCount;
    
    console.log(`   🔄 第 ${pollCount} 轮: 完成 ${completedCount}/${requestIds.length}, 剩余 ${remainingCount}, 轮询耗时 ${pollTime}ms`);
    
    if (globalStatus) {
      console.log(`       📊 队列状态: 队列中 ${globalStatus.totalInQueue}, 处理中 ${globalStatus.currentlyProcessing}`);
    }

    if (remainingCount > 0) {
      await new Promise(resolve => setTimeout(resolve, PERFORMANCE_CONFIG.statusPollInterval));
    }
  }

  const totalTime = Date.now() - startTime;
  
  // 分析性能数据
  console.log(`\n📈 性能分析结果:`);
  console.log(`   总请求数: ${requestIds.length}`);
  console.log(`   完成请求数: ${completedRequests.size}`);
  console.log(`   总耗时: ${Math.round(totalTime / 1000)} 秒`);
  console.log(`   轮询次数: ${pollCount}`);
  console.log(`   最大队列长度: ${maxQueueLength}`);
  console.log(`   最大并发处理数: ${maxProcessingCount}`);
  
  // 计算处理时间统计
  const processingTimes = Array.from(completedRequests.values()).map((endTime, index) => {
    const requestId = Array.from(completedRequests.keys())[index];
    const statusHistory = requestStatuses.get(requestId);
    if (statusHistory && statusHistory.length > 0) {
      const startTime = statusHistory[0].timestamp;
      return endTime - startTime;
    }
    return 0;
  }).filter(time => time > 0);

  if (processingTimes.length > 0) {
    const avgTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
    const minTime = Math.min(...processingTimes);
    const maxTime = Math.max(...processingTimes);
    
    console.log(`   平均处理时间: ${Math.round(avgTime)}ms`);
    console.log(`   最短处理时间: ${Math.round(minTime)}ms`);
    console.log(`   最长处理时间: ${Math.round(maxTime)}ms`);
  }

  // 分析状态转换
  console.log(`\n📋 状态转换分析:`);
  const statusCounts = new Map();
  requestStatuses.forEach((history) => {
    history.forEach((entry) => {
      statusCounts.set(entry.status, (statusCounts.get(entry.status) || 0) + 1);
    });
  });

  statusCounts.forEach((count, status) => {
    console.log(`   ${status}: ${count} 次`);
  });

  return {
    totalRequests: requestIds.length,
    completedRequests: completedRequests.size,
    totalTime,
    pollCount,
    maxQueueLength,
    maxProcessingCount,
    processingTimes
  };
}

async function runPerformanceTest() {
  console.log('🚀 排队系统性能测试');
  console.log('═══════════════════════════════════════');
  console.log('测试配置:');
  console.log(`   并发请求数: ${PERFORMANCE_CONFIG.concurrentRequests}`);
  console.log(`   批次大小: ${PERFORMANCE_CONFIG.requestBatchSize}`);
  console.log(`   批次间隔: ${PERFORMANCE_CONFIG.batchInterval}ms`);
  console.log(`   最大等待时间: ${PERFORMANCE_CONFIG.maxWaitTime}ms`);
  console.log(`   轮询间隔: ${PERFORMANCE_CONFIG.statusPollInterval}ms`);
  console.log('═══════════════════════════════════════\n');

  const startTime = Date.now();
  const allRequestIds = [];

  try {
    // 分批提交请求
    const totalBatches = Math.ceil(PERFORMANCE_CONFIG.concurrentRequests / PERFORMANCE_CONFIG.requestBatchSize);
    
    for (let batch = 1; batch <= totalBatches; batch++) {
      const remainingRequests = PERFORMANCE_CONFIG.concurrentRequests - allRequestIds.length;
      const batchSize = Math.min(PERFORMANCE_CONFIG.requestBatchSize, remainingRequests);
      
      const batchIds = await batchSubmitRequests(batch, batchSize);
      allRequestIds.push(...batchIds);
      
      // 批次间隔
      if (batch < totalBatches) {
        console.log(`   ⏱️ 等待 ${PERFORMANCE_CONFIG.batchInterval}ms 后提交下一批...`);
        await new Promise(resolve => setTimeout(resolve, PERFORMANCE_CONFIG.batchInterval));
      }
    }

    console.log(`\n✅ 所有请求已提交，共 ${allRequestIds.length} 个请求`);

    if (allRequestIds.length === 0) {
      console.log('❌ 没有成功提交的请求，无法进行性能测试');
      return;
    }

    // 监控性能
    const performanceResults = await monitorQueuePerformance(allRequestIds);

    // 生成性能报告
    const totalTime = Date.now() - startTime;
    
    console.log('\n═══════════════════════════════════════');
    console.log('🎯 性能测试报告:');
    console.log(`   总测试时间: ${Math.round(totalTime / 1000)} 秒`);
    console.log(`   请求成功率: ${Math.round((performanceResults.completedRequests / performanceResults.totalRequests) * 100)}%`);
    console.log(`   平均轮询延迟: ${Math.round(totalTime / performanceResults.pollCount)}ms`);
    
    if (performanceResults.processingTimes.length > 0) {
      const avgProcessingTime = performanceResults.processingTimes.reduce((a, b) => a + b, 0) / performanceResults.processingTimes.length;
      console.log(`   平均请求处理时间: ${Math.round(avgProcessingTime)}ms`);
    }
    
    console.log(`   最大队列负载: ${performanceResults.maxQueueLength}`);
    console.log(`   最大并发处理: ${performanceResults.maxProcessingCount}`);
    
    // 性能评估
    console.log('\n📊 性能评估:');
    if (performanceResults.completedRequests === performanceResults.totalRequests) {
      console.log('✅ 系统稳定性: 优秀 - 所有请求都成功处理');
    } else if (performanceResults.completedRequests / performanceResults.totalRequests > 0.8) {
      console.log('⚠️ 系统稳定性: 良好 - 大部分请求成功处理');
    } else {
      console.log('❌ 系统稳定性: 需要改进 - 较多请求处理失败');
    }
    
    if (performanceResults.maxQueueLength <= 5) {
      console.log('✅ 队列管理: 优秀 - 队列长度控制良好');
    } else if (performanceResults.maxQueueLength <= 10) {
      console.log('⚠️ 队列管理: 良好 - 队列长度适中');
    } else {
      console.log('❌ 队列管理: 需要优化 - 队列长度过长');
    }
    
    console.log('═══════════════════════════════════════\n');
    
    console.log('💡 优化建议:');
    if (performanceResults.maxQueueLength > 5) {
      console.log('   - 考虑增加并发处理数或优化处理速度');
    }
    if (performanceResults.completedRequests < performanceResults.totalRequests) {
      console.log('   - 检查错误处理机制和重试策略');
    }
    if (totalTime > 60000) {
      console.log('   - 考虑优化轮询间隔或处理效率');
    }
    
  } catch (error) {
    console.error('❌ 性能测试过程中发生错误:', error.message);
  }
}

// 运行性能测试
runPerformanceTest().catch(console.error);
