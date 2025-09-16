const fs = require('fs');

console.log('=== 正则表达式模式调试测试 ===\n');

// 创建测试用的各种图片格式的data URLs
const testCases = [
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAIBrEkKtQAAAABJRU5ErkJggg==',
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wA==',
  'data:image/jpg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wA==',
  'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA',
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB2aWV3Qm94PSIwIDAgMSAxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9InJlZCIvPjwvc3ZnPg==',
  'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
];

// 当前API中使用的有问题的正则表达式
const problematicRegex = /^data:image\/(jpeg|jpg|png|webp|gif|bmp|tiff|svg[+]xml);base64,(.+)$/;

// 修复后的正则表达式
const fixedRegex = /^data:image\/(jpeg|jpg|png|webp|gif|bmp|tiff|svg\+xml);base64,(.+)$/;

// 更宽松但安全的正则表达式
const flexibleRegex = /^data:image\/([a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/]*={0,2})$/;

console.log('测试不同的正则表达式模式:\n');

testCases.forEach((dataUrl, index) => {
  const format = dataUrl.match(/^data:image\/([^;]+);/)?.[1] || 'unknown';
  console.log(`测试用例 ${index + 1}: ${format.toUpperCase()}`);
  console.log(`  数据: ${dataUrl.substring(0, 60)}...`);
  
  console.log(`  有问题的regex: ${problematicRegex.test(dataUrl) ? '✅ 匹配' : '❌ 不匹配'}`);
  console.log(`  修复后的regex: ${fixedRegex.test(dataUrl) ? '✅ 匹配' : '❌ 不匹配'}`);
  console.log(`  宽松的regex:   ${flexibleRegex.test(dataUrl) ? '✅ 匹配' : '❌ 不匹配'}`);
  
  // 详细分析有问题的regex
  if (!problematicRegex.test(dataUrl)) {
    console.log(`  ⚠️ 问题分析: ${format}格式无法通过当前API验证`);
  }
  
  console.log('');
});

console.log('=== 问题诊断 ===\n');

console.log('1. 当前API中的regex问题:');
console.log('   /^data:image\\/(jpeg|jpg|png|webp|gif|bmp|tiff|svg[+]xml);base64,(.+)$/');
console.log('   ');
console.log('   问题: svg[+]xml 中的方括号创建了字符类 [+]');
console.log('   这匹配单个字符 + 而不是字符串 "+xml"');
console.log('   应该是: svg\\+xml (转义加号)');
console.log('');

console.log('2. 建议的修复方案:');
console.log('   方案A - 最小修复: 只修复SVG格式');
console.log('   /^data:image\\/(jpeg|jpg|png|webp|gif|bmp|tiff|svg\\+xml);base64,(.+)$/');
console.log('');
console.log('   方案B - 宽松但安全: 接受所有有效MIME类型');
console.log('   /^data:image\\/([a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/]*={0,2})$/');
console.log('   并单独验证base64内容');
console.log('');

console.log('3. 本地vs服务器差异原因:');
console.log('   - JavaScript引擎版本差异');
console.log('   - 字符编码处理差异');
console.log('   - 不同环境下的正则表达式实现细节');
console.log('');

console.log('4. 推荐解决方案:');
console.log('   使用方案B，因为它:');
console.log('   - 更宽松，兼容性更好');
console.log('   - 仍然安全，有适当的验证');
console.log('   - 对不同环境更稳健');
console.log('   - 支持未来的新图片格式');
