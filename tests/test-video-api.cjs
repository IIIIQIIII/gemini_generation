/**
 * 测试视频播放API的脚本
 * 该脚本测试本地视频API的各种功能
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const BASE_URL = 'http://localhost:3000';
const TEST_VIDEO_PATH = '/tmp/generated-video-1756780691248.mp4';

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(requestOptions, (res) => {
      let data = Buffer.alloc(0);
      
      res.on('data', (chunk) => {
        data = Buffer.concat([data, chunk]);
      });

      res.on('end', () => {
        resolve({
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: res.headers,
          data: data
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function testVideoAPI() {
  console.log('🧪 开始测试视频播放API...\n');

  // 1. 测试视频文件是否存在
  console.log('1️⃣ 检查测试视频文件...');
  if (!fs.existsSync(TEST_VIDEO_PATH)) {
    console.log('❌ 测试视频文件不存在:', TEST_VIDEO_PATH);
    console.log('请先生成一个视频后再运行此测试\n');
    return;
  }
  
  const stats = fs.statSync(TEST_VIDEO_PATH);
  console.log(`✅ 视频文件存在: ${TEST_VIDEO_PATH}`);
  console.log(`📊 文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB\n`);

  // 2. 测试API基本请求
  console.log('2️⃣ 测试API基本请求...');
  try {
    const response = await makeRequest(`${BASE_URL}/api/local-video?path=${encodeURIComponent(TEST_VIDEO_PATH)}`);
    console.log(`📡 响应状态: ${response.status} ${response.statusText}`);
    console.log('📝 响应头:');
    
    Object.keys(response.headers).forEach(key => {
      console.log(`   ${key}: ${response.headers[key]}`);
    });
    
    if (response.status === 200) {
      console.log(`📦 接收到数据: ${response.data.length} bytes`);
      console.log('✅ API基本请求成功\n');
    } else {
      console.log('❌ API基本请求失败\n');
      return;
    }
  } catch (error) {
    console.log('❌ API请求错误:', error.message, '\n');
    return;
  }

  // 3. 测试Range请求 (视频流关键功能)
  console.log('3️⃣ 测试Range请求...');
  try {
    const response = await makeRequest(`${BASE_URL}/api/local-video?path=${encodeURIComponent(TEST_VIDEO_PATH)}`, {
      headers: {
        'Range': 'bytes=0-1023' // 请求前1KB
      }
    });
    
    console.log(`📡 Range响应状态: ${response.status} ${response.statusText}`);
    console.log('📝 Range响应头:');
    
    Object.keys(response.headers).forEach(key => {
      console.log(`   ${key}: ${response.headers[key]}`);
    });
    
    if (response.status === 206) {
      console.log(`📦 接收到数据: ${response.data.length} bytes`);
      console.log('✅ Range请求成功\n');
    } else {
      console.log('❌ Range请求失败 - 应该返回206状态码\n');
    }
  } catch (error) {
    console.log('❌ Range请求错误:', error.message, '\n');
  }

  // 4. 测试CORS头
  console.log('4️⃣ 测试CORS头...');
  try {
    const response = await makeRequest(`${BASE_URL}/api/local-video?path=${encodeURIComponent(TEST_VIDEO_PATH)}`);
    
    const corsHeaders = [
      'access-control-allow-origin',
      'access-control-allow-methods',
      'access-control-allow-headers',
      'access-control-expose-headers'
    ];
    
    let corsOk = true;
    corsHeaders.forEach(header => {
      if (response.headers[header]) {
        console.log(`✅ ${header}: ${response.headers[header]}`);
      } else {
        console.log(`❌ 缺少CORS头: ${header}`);
        corsOk = false;
      }
    });
    
    if (corsOk) {
      console.log('✅ CORS配置正确\n');
    } else {
      console.log('❌ CORS配置有问题\n');
    }
  } catch (error) {
    console.log('❌ CORS测试错误:', error.message, '\n');
  }

  // 5. 测试OPTIONS请求
  console.log('5️⃣ 测试OPTIONS请求...');
  try {
    const response = await makeRequest(`${BASE_URL}/api/local-video?path=${encodeURIComponent(TEST_VIDEO_PATH)}`, {
      method: 'OPTIONS'
    });
    
    console.log(`📡 OPTIONS响应状态: ${response.status} ${response.statusText}`);
    
    if (response.status === 200) {
      console.log('✅ OPTIONS请求成功\n');
    } else {
      console.log('❌ OPTIONS请求失败\n');
    }
  } catch (error) {
    console.log('❌ OPTIONS请求错误:', error.message, '\n');
  }

  // 6. 测试无效路径
  console.log('6️⃣ 测试安全性 - 无效路径...');
  const invalidPaths = [
    '/etc/passwd',
    '../../../etc/passwd',
    '/tmp/nonexistent.mp4',
    '/tmp/test.txt'
  ];
  
  for (const invalidPath of invalidPaths) {
    try {
      const response = await makeRequest(`${BASE_URL}/api/local-video?path=${encodeURIComponent(invalidPath)}`);
      console.log(`🔒 无效路径 "${invalidPath}": ${response.status} ${response.statusText}`);
      
      if (response.status === 403 || response.status === 404) {
        console.log('✅ 安全检查正常');
      } else {
        console.log('⚠️  安全检查可能有问题');
      }
    } catch (error) {
      console.log(`❌ 测试无效路径错误: ${error.message}`);
    }
  }
  
  console.log('\n🎉 测试完成！');
  console.log('\n💡 如果所有测试都通过，视频播放问题可能是浏览器兼容性或编码问题。');
  console.log('建议：');
  console.log('1. 检查浏览器控制台网络选项卡，查看视频请求状态');
  console.log('2. 尝试不同的浏览器');
  console.log('3. 检查视频编码格式是否与浏览器兼容');
}

// 运行测试
testVideoAPI().catch(console.error);
