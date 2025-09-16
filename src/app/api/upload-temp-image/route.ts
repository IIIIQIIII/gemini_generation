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

    // Simple base64 data URL parsing
    const base64Data = imageData.split(',')[1] || imageData;
    const format = 'jpeg'; // Default format
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Create temp directory if it doesn't exist
    const tempDir = join(process.cwd(), 'public', 'temp');
    try {
      await mkdir(tempDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore error
    }

    // Generate unique filename
    const filename = `temp-image-${randomUUID()}.${format}`;
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
