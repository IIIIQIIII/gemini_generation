const fs = require('fs');
const path = require('path');

console.log('=== Mac截图格式分析 ===\n');

// 分析真实的Mac截图文件
const screenshotPath = '/Users/admin/Projects/aistudio/test1.png';

try {
  // 检查文件是否存在
  if (!fs.existsSync(screenshotPath)) {
    console.log('❌ 文件不存在:', screenshotPath);
    process.exit(1);
  }

  // 获取文件信息
  const stats = fs.statSync(screenshotPath);
  console.log('📁 文件信息:');
  console.log(`   路径: ${screenshotPath}`);
  console.log(`   大小: ${stats.size} bytes`);
  console.log(`   修改时间: ${stats.mtime}`);

  // 读取文件并转换为base64
  const imageBuffer = fs.readFileSync(screenshotPath);
  const base64Data = imageBuffer.toString('base64');
  
  console.log('\n🔍 Base64数据分析:');
  console.log(`   Base64长度: ${base64Data.length}`);
  console.log(`   前100字符: ${base64Data.substring(0, 100)}...`);
  console.log(`   后20字符: ...${base64Data.substring(base64Data.length - 20)}`);

  // 创建标准data URL
  const standardDataUrl = `data:image/png;base64,${base64Data}`;
  console.log('\n📝 生成的Data URL:');
  console.log(`   完整长度: ${standardDataUrl.length}`);
  console.log(`   前80字符: ${standardDataUrl.substring(0, 80)}...`);

  // 测试不同的正则表达式
  const patterns = [
    {
      name: '当前严格模式',
      regex: /^data:image\/(jpeg|jpg|png|webp|gif|bmp|tiff|svg\+xml);base64,(.+)$/
    },
    {
      name: '原始严格模式 (修复前)',
      regex: /^data:image\/(jpeg|jpg|png);base64,(.+)$/
    },
    {
      name: '宽松模式',
      regex: /^data:image\/[^;]+;base64,.+$/
    }
  ];

  console.log('\n🧪 正则表达式匹配测试:');
  patterns.forEach(({ name, regex }) => {
    const matches = standardDataUrl.match(regex);
    const status = matches ? '✅ 匹配' : '❌ 不匹配';
    console.log(`   ${name}: ${status}`);
    
    if (matches && matches[1]) {
      console.log(`     - 检测到的格式: ${matches[1]}`);
      if (matches[2]) {
        console.log(`     - Base64数据长度: ${matches[2].length}`);
        
        // 验证base64有效性
        const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
        const isValid = base64Pattern.test(matches[2]);
        console.log(`     - Base64有效性: ${isValid ? '✅' : '❌'}`);
        
        if (!isValid) {
          // 找出无效字符
          const invalidChars = matches[2].match(/[^A-Za-z0-9+/=]/g);
          if (invalidChars) {
            console.log(`     - 发现无效字符: ${JSON.stringify([...new Set(invalidChars)])}`);
          }
        }
      }
    }
  });

  // 模拟不同可能的格式问题
  console.log('\n🔧 可能的问题模拟测试:');
  
  const problemFormats = [
    {
      name: '包含换行符的base64',
      data: `data:image/png;base64,${base64Data.replace(/(.{76})/g, '$1\n')}`
    },
    {
      name: '包含空格的base64',
      data: `data:image/png;base64, ${base64Data}`
    },
    {
      name: '缺少MIME参数',
      data: `data:image/png,${base64Data}`
    }
  ];

  problemFormats.forEach(({ name, data }) => {
    const testData = data.substring(0, 200); // 只测试前200字符避免输出过长
    const matches = patterns[0] ? testData.match(patterns[0].regex) : null;
    console.log(`   ${name}: ${matches ? '✅ 匹配' : '❌ 不匹配'}`);
  });

  // 实际API测试
  async function testWithAPI() {
    console.log('\n🌐 实际API测试:');
    
    try {
      const response = await fetch('http://localhost:3001/api/upload-temp-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageData: standardDataUrl,
          index: 1 
        }),
      });
      
      const result = await response.json();
      console.log(`   upload-temp-image状态: ${response.status}`);
      console.log(`   结果: ${result.success ? '✅ 成功' : '❌ 失败'}`);
      
      if (!result.success) {
        console.log(`   错误消息: ${result.error}`);
      } else {
        console.log(`   生成的URL: ${result.url}`);
        
        // 测试volcengine-image API
        console.log('\n   测试volcengine-image API...');
        const volcResponse = await fetch('http://localhost:3001/api/volcengine-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'doubao-seedream-4-0-250828',
            prompt: '测试真实截图',
            image: result.url,
            size: '2K',
            response_format: 'b64_json',
            watermark: true
          }),
        });
        
        const volcResult = await volcResponse.json();
        console.log(`   volcengine-image状态: ${volcResponse.status}`);
        console.log(`   结果: ${volcResult.success || volcResult.error ? (volcResult.success ? '✅ 成功' : '❌ 失败') : '❓ 未知'}`);
        
        if (volcResult.error) {
          console.log(`   错误消息: ${volcResult.error}`);
        }
      }
      
    } catch (error) {
      console.log(`   API测试失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // 检查服务器状态并测试
  fetch('http://localhost:3001/api/upload-temp-image', { method: 'OPTIONS' })
    .then(() => {
      console.log('\n✅ 检测到开发服务器运行中');
      return testWithAPI();
    })
    .catch(() => {
      console.log('\n⚠️ 开发服务器未运行，跳过API测试');
      console.log('如需测试API，请运行: npm run dev');
    });

} catch (error) {
  console.error('❌ 分析失败:', error instanceof Error ? error.message : String(error));
  
  if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
    console.log('\n💡 建议:');
    console.log('1. 请确认文件路径是否正确');
    console.log('2. 请确认文件是否存在');
    console.log('3. 可以使用以下命令检查:');
    console.log('   ls -la /Users/admin/Projects/aistudio/test1.png');
  }
}
