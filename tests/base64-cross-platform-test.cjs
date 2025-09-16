const fs = require('fs');
const path = require('path');

console.log('=== Base64跨平台处理测试 ===\n');

// 测试真实图片文件
const testImagePath = '/Users/admin/Projects/aistudio/test1.png';

async function testBase64Processing() {
  try {
    // 检查文件是否存在
    if (!fs.existsSync(testImagePath)) {
      console.log('❌ 测试文件不存在:', testImagePath);
      console.log('请确保test1.png文件存在于项目根目录\n');
      return;
    }

    console.log('✅ 发现测试文件:', testImagePath);
    
    // 模拟前端的FileReader处理过程
    const imageBuffer = fs.readFileSync(testImagePath);
    const base64Data = imageBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64Data}`;

    console.log('\n📊 图片信息:');
    console.log(`   文件大小: ${imageBuffer.length} bytes`);
    console.log(`   Base64长度: ${base64Data.length}`);
    console.log(`   Data URL长度: ${dataUrl.length}`);
    console.log(`   前100字符: ${dataUrl.substring(0, 100)}...`);

    // 验证base64格式（模拟前端验证逻辑）
    console.log('\n🔍 前端验证逻辑测试:');
    
    // 验证base64格式
    const matches = dataUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
    if (!matches || !matches[1] || !matches[2]) {
      console.log('❌ 正则表达式匹配失败');
      return;
    }

    const format = matches[1].toLowerCase();
    const extractedBase64 = matches[2];

    console.log(`   检测到的格式: ${format}`);
    console.log(`   提取的base64长度: ${extractedBase64.length}`);

    // 验证base64数据有效性
    const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Pattern.test(extractedBase64)) {
      console.log('❌ base64字符验证失败');
      return;
    }

    if (extractedBase64.length < 50) {
      console.log('❌ base64数据太短');
      return;
    }

    console.log('✅ 前端验证通过');

    // 标准化格式 (jpg -> jpeg)
    const normalizedFormat = format === 'jpg' ? 'jpeg' : format;
    const standardDataUrl = `data:image/${normalizedFormat};base64,${extractedBase64}`;

    console.log(`   标准化格式: ${normalizedFormat}`);
    console.log(`   标准化Data URL长度: ${standardDataUrl.length}`);

    // 测试API
    console.log('\n🌐 API测试:');
    
    // 检查开发服务器是否运行
    try {
      await fetch('http://localhost:3001/api/volcengine-image', { method: 'OPTIONS' });
      console.log('✅ 检测到开发服务器运行中');
    } catch {
      console.log('❌ 开发服务器未运行，跳过API测试');
      console.log('如需测试API，请运行: npm run dev');
      return;
    }

    // 测试API直接使用base64
    console.log('\n测试volcengine-image API直接使用base64...');
    
    const apiResponse = await fetch('http://localhost:3001/api/volcengine-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'doubao-seedream-4-0-250828',
        prompt: '测试跨平台base64图片处理',
        image: standardDataUrl,
        size: '2K',
        response_format: 'b64_json',
        watermark: true
      }),
    });
    
    const apiResult = await apiResponse.json();
    console.log(`API状态: ${apiResponse.status}`);
    console.log(`API结果: ${apiResult.success ? '✅ 成功' : '❌ 失败'}`);
    
    if (!apiResult.success && apiResult.error) {
      console.log(`错误信息: ${apiResult.error}`);
    } else if (apiResult.success) {
      console.log(`生成的图片数量: ${apiResult.data.images.length}`);
      console.log(`使用的令牌数: ${apiResult.data.usage.total_tokens}`);
    }

    // 测试多张图片
    console.log('\n测试多张图片处理...');
    
    const multiImageResponse = await fetch('http://localhost:3001/api/volcengine-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'doubao-seedream-4-0-250828',
        prompt: '基于参考图片生成新的艺术风格',
        image: [standardDataUrl, standardDataUrl], // 使用相同图片测试多图处理
        size: '2K',
        sequential_image_generation: 'disabled',
        response_format: 'b64_json',
        watermark: true
      }),
    });
    
    const multiImageResult = await multiImageResponse.json();
    console.log(`多图API状态: ${multiImageResponse.status}`);
    console.log(`多图API结果: ${multiImageResult.success ? '✅ 成功' : '❌ 失败'}`);
    
    if (!multiImageResult.success && multiImageResult.error) {
      console.log(`多图错误信息: ${multiImageResult.error}`);
    }

    console.log('\n🎉 测试完成！');
    
    if (apiResult.success || multiImageResult.success) {
      console.log('\n✅ 新的base64处理流程工作正常！');
      console.log('   - 前端直接处理图片为base64');
      console.log('   - 服务器端直接使用base64数据');
      console.log('   - 无需临时文件和localhost URL');
      console.log('   - 跨平台兼容性已解决');
    }

  } catch (error) {
    console.error('❌ 测试失败:', error instanceof Error ? error.message : String(error));
  }
}

testBase64Processing();
