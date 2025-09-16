// Test script to validate image format fixes for Singapore server deployment
const fetch = require('node-fetch');

async function testImageFormats() {
  console.log('=== 测试图片格式验证修复 ===\n');

  // Test cases for different image formats
  const testCases = [
    {
      name: '正确的JPEG Data URL格式',
      image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A',
      shouldSucceed: true
    },
    {
      name: '正确的PNG Data URL格式',
      image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGA',
      shouldSucceed: true
    },
    {
      name: '无效的Base64字符',
      image: 'data:image/jpeg;base64,invalid@#$%characters',
      shouldSucceed: false,
      expectedError: '包含无效的base64字符'
    },
    {
      name: '缺少Base64前缀的格式',
      image: '/9j/4AAQSkZJRgABAQEAYABgAAD',
      shouldSucceed: true // Should auto-convert to proper format
    },
    {
      name: 'HTTP URL格式',
      image: 'https://example.com/image.jpg',
      shouldSucceed: true
    },
    {
      name: '无效的URL格式',
      image: 'invalid-url',
      shouldSucceed: false,
      expectedError: '包含无效的base64字符'
    }
  ];

  for (const testCase of testCases) {
    console.log(`测试: ${testCase.name}`);
    
    try {
      const response = await fetch('http://localhost:3001/api/volcengine-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'doubao-seedream-4-0-250828',
          prompt: '一只可爱的小猫',
          image: testCase.image,
          sequential_image_generation: 'disabled',
          size: '2K'
        }),
      });

      const result = await response.json();
      
      if (testCase.shouldSucceed) {
        if (response.ok || result.error?.includes('Volcengine API Key')) {
          console.log('✅ 格式验证通过 (API Key 相关错误是预期的)');
        } else {
          console.log('❌ 应该成功但失败了:', result.error);
        }
      } else {
        if (!response.ok && result.error?.includes(testCase.expectedError)) {
          console.log('✅ 正确捕获了格式错误');
        } else {
          console.log('❌ 没有正确捕获格式错误:', result.error);
        }
      }
      
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log('⚠️ 开发服务器未运行，请先启动服务器');
        break;
      }
      console.log('❌ 测试失败:', error.message);
    }
    
    console.log('---\n');
  }

  console.log('=== 测试完成 ===');
  console.log('修复要点:');
  console.log('1. 添加了严格的Base64格式验证');
  console.log('2. 自动转换缺少前缀的Base64数据');
  console.log('3. 支持JPEG、PNG和URL格式');
  console.log('4. 提供详细的错误信息');
  console.log('\n部署到新加坡服务器时，这些修复应该能解决"字符串不匹配"的错误。');
}

// 运行测试
testImageFormats().catch(console.error);
