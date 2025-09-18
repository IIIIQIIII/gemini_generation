// 测试视频分析功能
const fs = require('fs');
const path = require('path');

async function testVideoAnalysis() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('🧪 测试视频分析功能...');
  
  // 测试数据
  const testData = {
    prompt: '请描述这个视频的内容',
    youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // 示例YouTube链接
    useVertexAI: false,
    apiKey: 'test-api-key'
  };
  
  try {
    // 第一步：提交到队列
    console.log('📤 提交任务到排队系统...');
    const submitResponse = await fetch(`${baseUrl}/api/queue/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint: 'analyze-video',
        data: testData
      }),
    });
    
    const submitResult = await submitResponse.json();
    console.log('✅ 提交结果:', submitResult);
    
    if (!submitResponse.ok) {
      console.error('❌ 提交失败:', submitResult.error);
      return;
    }
    
    const itemId = submitResult.itemId;
    console.log('🎉 测试通过！视频分析端点已成功注册到排队系统');
    console.log('📝 任务ID:', itemId);
    
    // 第二步：测试状态查询
    console.log('\n🔍 测试状态查询...');
    const statusResponse = await fetch(`${baseUrl}/api/queue/status?itemId=${itemId}`);
    const statusResult = await statusResponse.json();
    
    if (statusResponse.ok) {
      console.log('✅ 状态查询成功:', statusResult);
    } else {
      console.error('❌ 状态查询失败:', statusResult.error);
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error instanceof Error ? error.message : String(error));
  }
}

// 测试支持的端点
async function testSupportedEndpoints() {
  const baseUrl = 'http://localhost:3000';
  console.log('\n🔍 测试所有支持的端点...');
  
  const endpoints = [
    'generate-text',
    'generate-image', 
    'edit-image',
    'generate-video',
    'volcengine-image',
    'volcengine-video',
    'qianfan-video',
    'speech-synthesize',
    'analyze-video',
    'analyze-image',
    'subtitle-submit'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${baseUrl}/api/queue/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint,
          data: { test: true }
        }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        console.log(`✅ ${endpoint}: 支持`);
      } else {
        console.log(`❌ ${endpoint}: ${result.error}`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint}: 网络错误 - ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function runTests() {
  console.log('🚀 开始测试视频分析排队系统...\n');
  
  await testVideoAnalysis();
  await testSupportedEndpoints();
  
  console.log('\n✨ 测试完成！');
}

// 如果直接运行此文件
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testVideoAnalysis,
  testSupportedEndpoints,
  runTests
};
