const fs = require('fs');
const path = require('path');

console.log('=== PNG格式调试测试 ===\n');

// 创建一个真实的PNG图片 (1x1像素透明PNG)
const realPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAIBrEkKtQAAAABJRU5ErkJggg==';
const pngDataUrl = `data:image/png;base64,${realPngBase64}`;

console.log('测试PNG数据:');
console.log('长度:', pngDataUrl.length);
console.log('前50字符:', pngDataUrl.substring(0, 50));
console.log('格式匹配测试:');

// 测试不同的正则表达式
const patterns = [
  { name: '原始严格模式', regex: /^data:image\/(jpeg|jpg|png);base64,(.+)$/ },
  { name: '扩展格式支持', regex: /^data:image\/(jpeg|jpg|png|webp|gif|bmp|tiff|svg\+xml);base64,(.+)$/ },
  { name: '宽松模式', regex: /^data:image\/[^;]+;base64,.+$/ }
];

patterns.forEach(({ name, regex }) => {
  const matches = pngDataUrl.match(regex);
  console.log(`${name}: ${matches ? '✅ 匹配' : '❌ 不匹配'}`);
  if (matches && matches[1]) {
    console.log(`  - 格式: ${matches[1]}`);
    console.log(`  - Base64数据长度: ${matches[2] ? matches[2].length : '未捕获'}`);
  }
});

console.log('\n=== 测试API端点 ===');

async function testApi() {
  try {
    // 首先测试upload-temp-image
    console.log('1. 测试 upload-temp-image API...');
    
    const uploadResponse = await fetch('http://localhost:3001/api/upload-temp-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        imageData: pngDataUrl,
        index: 1 
      }),
    });
    
    const uploadResult = await uploadResponse.json();
    console.log('upload-temp-image 状态:', uploadResponse.status);
    console.log('upload-temp-image 结果:', uploadResult);
    
    if (uploadResult.success) {
      console.log('\n2. 测试 volcengine-image API 使用URL...');
      
      const volcanResponse = await fetch('http://localhost:3001/api/volcengine-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'doubao-seedream-4-0-250828',
          prompt: '测试图片生成',
          image: uploadResult.url,
          size: '2K',
          response_format: 'b64_json',
          watermark: true
        }),
      });
      
      const volcanResult = await volcanResponse.json();
      console.log('volcengine-image 状态:', volcanResponse.status);
      console.log('volcengine-image 结果:', volcanResult);
    }
    
    console.log('\n3. 测试 volcengine-image API 直接使用base64...');
    
    const directResponse = await fetch('http://localhost:3001/api/volcengine-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'doubao-seedream-4-0-250828',
        prompt: '测试图片生成',
        image: pngDataUrl,
        size: '2K',
        response_format: 'b64_json',
        watermark: true
      }),
    });
    
    const directResult = await directResponse.json();
    console.log('volcengine-image 直接base64 状态:', directResponse.status);
    console.log('volcengine-image 直接base64 结果:', directResult);
    
  } catch (error) {
    console.error('API测试失败:', error.message);
    console.log('\n⚠️ 请确保开发服务器在端口3001运行 (npm run dev)');
  }
}

// 检查服务器是否运行
fetch('http://localhost:3001/api/upload-temp-image', { method: 'OPTIONS' })
  .then(() => {
    console.log('✅ 检测到开发服务器运行中\n');
    testApi();
  })
  .catch(() => {
    console.log('❌ 开发服务器未运行，跳过API测试');
    console.log('如需测试API，请运行: npm run dev');
  });
