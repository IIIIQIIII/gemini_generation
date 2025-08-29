import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';

export async function GET() {
  try {
    console.log('Testing video download functionality...');
    
    // Check if there are any video files in /tmp directory
    const { readdirSync } = await import('fs');
    const tmpFiles = readdirSync('/tmp').filter(file => file.endsWith('.mp4'));
    
    if (tmpFiles.length === 0) {
      return NextResponse.json({
        success: false,
        message: '没有找到可测试的视频文件',
        suggestion: '请先生成一个视频，然后再测试下载功能'
      });
    }

    // Use the most recent video file for testing
    const testVideoFile = tmpFiles.sort().pop();
    const testVideoPath = `/tmp/${testVideoFile}`;
    
    console.log(`Testing with video file: ${testVideoPath}`);
    
    // Test 1: Check if file exists and is readable
    if (!existsSync(testVideoPath)) {
      return NextResponse.json({
        success: false,
        error: '测试文件不存在',
        testVideoPath
      });
    }
    
    // Test 2: Check file size
    const stats = await import('fs').then(fs => fs.statSync(testVideoPath));
    const fileSizeBytes = stats.size;
    const fileSizeMB = (fileSizeBytes / 1024 / 1024).toFixed(2);
    
    console.log(`Video file size: ${fileSizeMB}MB`);
    
    if (fileSizeBytes === 0) {
      return NextResponse.json({
        success: false,
        error: '测试文件为空',
        testVideoPath,
        fileSizeBytes
      });
    }
    
    // Test 3: Try to read a small portion of the file to verify it's a valid video
    try {
      const buffer = readFileSync(testVideoPath);
      const header = buffer.slice(0, 16);
      
      // Check for common video file signatures
      const isValidVideo = 
        header.includes(Buffer.from('ftyp')) || // MP4
        header.includes(Buffer.from('moov')) || // MOV
        buffer.slice(0, 4).toString('hex') === '00000020' || // MP4 variant
        buffer.slice(4, 8).toString() === 'ftyp'; // MP4 ftyp box
        
      if (!isValidVideo) {
        return NextResponse.json({
          success: false,
          error: '文件不是有效的视频格式',
          testVideoPath,
          fileSizeBytes,
          headerHex: header.toString('hex')
        });
      }
      
    } catch (readError) {
      return NextResponse.json({
        success: false,
        error: '无法读取测试文件',
        details: readError instanceof Error ? readError.message : 'Unknown error',
        testVideoPath
      });
    }
    
    // Test 4: Simulate the download API functionality
    try {
      const videoBuffer = readFileSync(testVideoPath);
      
      return NextResponse.json({
        success: true,
        message: '视频下载功能测试通过',
        testResults: {
          fileExists: true,
          fileSize: `${fileSizeMB}MB`,
          fileSizeBytes,
          isValidVideo: true,
          readableFromServer: true,
          testVideoPath
        },
        downloadTest: {
          status: 'ready',
          message: '服务器可以成功读取并返回视频文件',
          contentType: 'video/mp4',
          contentLength: fileSizeBytes
        },
        instructions: {
          frontend: '前端可以通过 fetch(/api/download-video) 获取视频文件',
          browser: '浏览器会自动触发下载对话框',
          filename: '文件名将自动生成为 generated-video-{timestamp}.mp4'
        }
      });
      
    } catch (simulationError) {
      return NextResponse.json({
        success: false,
        error: '下载模拟测试失败',
        details: simulationError instanceof Error ? simulationError.message : 'Unknown error',
        testVideoPath
      });
    }
    
  } catch (error) {
    console.error('Download test error:', error);
    return NextResponse.json({
      success: false,
      error: '测试过程中发生错误',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// POST endpoint for testing specific video file download
export async function POST(request: NextRequest) {
  try {
    const { localVideoPath, videoFile } = await request.json();
    
    if (!localVideoPath && !videoFile) {
      return NextResponse.json({
        error: '请提供本地视频路径或视频文件信息进行测试'
      }, { status: 400 });
    }
    
    console.log('Testing specific video download:', { localVideoPath, videoFile });
    
    // Test with provided local path
    if (localVideoPath) {
      try {
        if (!existsSync(localVideoPath)) {
          return NextResponse.json({
            success: false,
            error: '指定的视频文件不存在',
            localVideoPath
          });
        }
        
        const stats = await import('fs').then(fs => fs.statSync(localVideoPath));
        const buffer = readFileSync(localVideoPath);
        
        return NextResponse.json({
          success: true,
          message: '指定视频文件测试通过',
          testResults: {
            localVideoPath,
            fileSize: `${(stats.size / 1024 / 1024).toFixed(2)}MB`,
            fileSizeBytes: stats.size,
            readable: true
          }
        });
        
      } catch (error) {
        return NextResponse.json({
          success: false,
          error: '无法读取指定的视频文件',
          localVideoPath,
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return NextResponse.json({
      success: false,
      message: '请提供有效的测试参数'
    });
    
  } catch (error) {
    console.error('Specific download test error:', error);
    return NextResponse.json({
      success: false,
      error: '测试过程中发生错误',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
