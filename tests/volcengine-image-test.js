// @ts-nocheck
const test = require('node:test');
const assert = require('node:assert');

// Test different prompt formats for sequential image generation
async function testVolcengineImageGeneration() {
  const apiKey = process.env.VOLCENGINE_API_KEY;
  
  if (!apiKey) {
    console.error('错误: VOLCENGINE_API_KEY 环境变量未设置');
    return;
  }
  
  const testCases = [
    {
      name: '明确要求生成多张图片的提示词',
      prompt: '生成3张不同风格的猫咪图片：卡通风格、写实风格、水彩风格',
      expectedImages: 3
    },
    {
      name: '包含序列概念的提示词',
      prompt: '一只猫从早晨到晚上的生活状态，展现不同时间段的活动',
      expectedImages: 3
    },
    {
      name: '故事性提示词',
      prompt: '一个小女孩在公园里玩耍的连续场景：到达公园、荡秋千、喂鸭子',
      expectedImages: 3
    },
    {
      name: '普通单一描述',
      prompt: '一只可爱的橘猫坐在窗边',
      expectedImages: 1
    }
  ];

  console.log('=== Volcengine Seedream 4.0 序列图像生成测试 ===\n');

  for (const testCase of testCases) {
    console.log(`测试用例: ${testCase.name}`);
    console.log(`提示词: ${testCase.prompt}`);
    console.log(`期望图片数: ${testCase.expectedImages}`);
    
    try {
      const requestBody = {
        model: 'doubao-seedream-4-0-250828',
        prompt: testCase.prompt,
        sequential_image_generation: 'auto',
        sequential_image_generation_options: {
          max_images: 5
        },
        size: '2K',
        response_format: 'b64_json',
        watermark: true
      };

      console.log('请求参数:', JSON.stringify(requestBody, null, 2));

      const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API错误:', errorData);
        continue;
      }

      const data = await response.json();
      console.log(`实际生成图片数: ${data.data.length}`);
      console.log(`Token消耗: ${data.usage.total_tokens}`);
      
      // 检查是否有错误的图片
      const errorImages = data.data.filter(item => item.error);
      if (errorImages.length > 0) {
        console.log(`错误图片数: ${errorImages.length}`);
        errorImages.forEach((err, index) => {
          console.log(`  错误${index + 1}: ${err.error.message}`);
        });
      }

      const successfulImages = data.data.filter(item => !item.error);
      console.log(`成功生成图片数: ${successfulImages.length}`);
      
      // 分析结果
      if (successfulImages.length === testCase.expectedImages) {
        console.log('✅ 结果符合预期');
      } else if (successfulImages.length > 1 && testCase.expectedImages > 1) {
        console.log('⚠️ 生成了多张图片，但数量与预期不同');
      } else if (successfulImages.length === 1 && testCase.expectedImages > 1) {
        console.log('❌ 期望生成多张图片，但只生成了1张');
      } else {
        console.log('✅ 生成了单张图片（符合预期）');
      }

    } catch (error) {
      console.error('测试失败:', error.message);
    }
    
    console.log('---\n');
    
    // 避免请求过于频繁
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// 运行测试
testVolcengineImageGeneration().catch(console.error);
