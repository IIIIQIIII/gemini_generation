import { type NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { imageData, index } = await request.json();
    
    if (!imageData) {
      return NextResponse.json(
        { error: '没有提供图片数据' },
        { status: 400 }
      );
    }

    // Parse base64 data URL - 支持更多图片格式
    const matches = imageData.match(/^data:image\/(jpeg|jpg|png|webp|gif|bmp|tiff|svg\+xml);base64,(.+)$/);
    if (!matches) {
      // 提供更详细的错误信息帮助调试
      console.log('Invalid image format received:', imageData.substring(0, 100));
      return NextResponse.json(
        { error: `无效的图片格式。支持：JPEG、PNG、WebP、GIF、BMP、TIFF、SVG。接收到：${imageData.substring(0, 50)}...` },
        { status: 400 }
      );
    }

    const [, format, base64Data] = matches;
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Create temp directory if it doesn't exist
    const tempDir = join(process.cwd(), 'public', 'temp');
    try {
      await mkdir(tempDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore error
    }

    // Generate unique filename
    const filename = `temp-image-${randomUUID()}.${format === 'jpg' ? 'jpeg' : format}`;
    const filepath = join(tempDir, filename);
    
    // Write file
    await writeFile(filepath, buffer);
    
    // Generate URL
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host');
    const imageUrl = `${protocol}://${host}/temp/${filename}`;
    
    return NextResponse.json({
      success: true,
      url: imageUrl,
      filename
    });

  } catch (error) {
    console.error('Upload temp image error:', error);
    return NextResponse.json(
      { error: '上传图片失败' },
      { status: 500 }
    );
  }
}
