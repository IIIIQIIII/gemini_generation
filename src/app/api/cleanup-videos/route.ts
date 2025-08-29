import { NextRequest, NextResponse } from 'next/server';
import { readdir, unlink, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const TEMP_DIR = '/tmp';
const MAX_AGE_HOURS = 2; // 2小时后自动删除
const MAX_VIDEO_COUNT = 10; // 最多保存10个视频文件

export async function POST(request: NextRequest) {
  try {
    console.log('Starting video cleanup...');
    
    if (!existsSync(TEMP_DIR)) {
      return NextResponse.json({ message: 'Temp directory not found' });
    }

    // Get all video files in temp directory
    const files = await readdir(TEMP_DIR);
    const videoFiles = files.filter(file => 
      (file.startsWith('generated-video-') || file.startsWith('video-')) && 
      file.endsWith('.mp4')
    );

    console.log(`Found ${videoFiles.length} video files`);

    let deletedCount = 0;
    const now = Date.now();

    // Delete old files (older than MAX_AGE_HOURS)
    for (const file of videoFiles) {
      try {
        const filePath = path.join(TEMP_DIR, file);
        const stats = await stat(filePath);
        const ageHours = (now - stats.mtime.getTime()) / (1000 * 60 * 60);

        if (ageHours > MAX_AGE_HOURS) {
          await unlink(filePath);
          deletedCount++;
          console.log(`Deleted old video: ${file} (age: ${ageHours.toFixed(1)} hours)`);
        }
      } catch (error) {
        console.error(`Error deleting ${file}:`, error);
      }
    }

    // If still too many files, delete oldest ones
    const remainingFiles = videoFiles.filter(async file => {
      const filePath = path.join(TEMP_DIR, file);
      return existsSync(filePath);
    });

    if (remainingFiles.length > MAX_VIDEO_COUNT) {
      // Get file stats for sorting
      const fileStats = await Promise.all(
        remainingFiles.slice(0, remainingFiles.length - MAX_VIDEO_COUNT).map(async file => {
          try {
            const filePath = path.join(TEMP_DIR, file);
            const stats = await stat(filePath);
            return { file, filePath, mtime: stats.mtime.getTime() };
          } catch {
            return null;
          }
        })
      );

      // Sort by age and delete oldest
      const validStats = fileStats.filter(s => s !== null);
      validStats.sort((a, b) => a!.mtime - b!.mtime);

      for (const fileInfo of validStats.slice(0, validStats.length - MAX_VIDEO_COUNT)) {
        try {
          await unlink(fileInfo!.filePath);
          deletedCount++;
          console.log(`Deleted excess video: ${fileInfo!.file}`);
        } catch (error) {
          console.error(`Error deleting ${fileInfo!.file}:`, error);
        }
      }
    }

    return NextResponse.json({
      message: `Cleanup completed. Deleted ${deletedCount} video files.`,
      deletedCount,
      remainingFiles: videoFiles.length - deletedCount
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Cleanup failed' },
      { status: 500 }
    );
  }
}

// GET endpoint to check video storage status
export async function GET(request: NextRequest) {
  try {
    if (!existsSync(TEMP_DIR)) {
      return NextResponse.json({ videoCount: 0, totalSize: 0 });
    }

    const files = await readdir(TEMP_DIR);
    const videoFiles = files.filter(file => 
      (file.startsWith('generated-video-') || file.startsWith('video-')) && 
      file.endsWith('.mp4')
    );

    let totalSize = 0;
    const now = Date.now();
    const fileInfos = [];

    for (const file of videoFiles) {
      try {
        const filePath = path.join(TEMP_DIR, file);
        const stats = await stat(filePath);
        const ageHours = (now - stats.mtime.getTime()) / (1000 * 60 * 60);
        
        totalSize += stats.size;
        fileInfos.push({
          name: file,
          size: stats.size,
          ageHours: Math.round(ageHours * 10) / 10,
          willBeDeleted: ageHours > MAX_AGE_HOURS
        });
      } catch (error) {
        console.error(`Error reading ${file}:`, error);
      }
    }

    return NextResponse.json({
      videoCount: videoFiles.length,
      totalSize: Math.round(totalSize / 1024 / 1024 * 100) / 100, // MB
      maxAgeHours: MAX_AGE_HOURS,
      maxVideoCount: MAX_VIDEO_COUNT,
      files: fileInfos
    });

  } catch (error) {
    console.error('Storage check error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Storage check failed' },
      { status: 500 }
    );
  }
}
