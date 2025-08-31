'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

interface DetectionObject {
  label: string;
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized to 0-1000
  confidence?: number;
}

interface DetectionResult {
  objects: DetectionObject[];
}

interface ImageVisualizationProps {
  imageUrl: string;
  result: string;
  analysisType: 'general' | 'detection';
}

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2'
];

export function ImageVisualization({ imageUrl, result, analysisType }: ImageVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [parsedResult, setParsedResult] = useState<DetectionResult | null>(null);
  const [redrawTrigger, setRedrawTrigger] = useState(0);

  // Add resize listener to redraw when window size changes
  useEffect(() => {
    const handleResize = () => {
      setRedrawTrigger(prev => prev + 1);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const drawDetectionBoxes = useCallback((
    ctx: CanvasRenderingContext2D,
    objects: DetectionObject[],
    canvasWidth: number,
    canvasHeight: number
  ) => {
    objects.forEach((obj, index) => {
      const color = COLORS[index % COLORS.length] || '#FF6B6B';
      const [ymin, xmin, ymax, xmax] = obj.box_2d;

      // Convert normalized coordinates (0-1000) to pixel coordinates
      const x = (xmin / 1000) * canvasWidth;
      const y = (ymin / 1000) * canvasHeight;
      const width = ((xmax - xmin) / 1000) * canvasWidth;
      const height = ((ymax - ymin) / 1000) * canvasHeight;

      // Draw solid boxes for detection
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);

      // Draw label background
      const label = obj.confidence 
        ? `${obj.label} (${(obj.confidence * 100).toFixed(1)}%)`
        : obj.label;
      
      ctx.font = 'bold 14px Arial';
      const textMetrics = ctx.measureText(label);
      const textWidth = textMetrics.width;
      const textHeight = 18;
      const padding = 6;

      // Calculate label position - place it above the box, or below if not enough space
      let labelY = y - textHeight - padding;
      if (labelY < 0) {
        labelY = y + height + textHeight + padding;
      }

      // Draw label background with border
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.fillRect(x, labelY - textHeight, textWidth + padding * 2, textHeight + padding);
      
      // Draw label border
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, labelY - textHeight, textWidth + padding * 2, textHeight + padding);

      // Draw label text
      ctx.fillStyle = color;
      ctx.fillText(label, x + padding, labelY - 2);
    });
  }, []);

  // Parse JSON result
  useEffect(() => {
    if (analysisType === 'detection') {
      try {
        // Try to extract JSON from the result text
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          setParsedResult(parsed);
        } else {
          setParsedResult(null);
        }
      } catch (error) {
        console.error('Failed to parse result:', error);
        setParsedResult(null);
      }
    }
  }, [result, analysisType]);

  // Draw visualizations on canvas
  useEffect(() => {
    if (!imageLoaded || !canvasRef.current || !imageRef.current || !parsedResult) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const image = imageRef.current;

    if (!ctx) return;

    // Get the actual displayed size of the image
    const imageRect = image.getBoundingClientRect();
    const displayWidth = imageRect.width;
    const displayHeight = imageRect.height;

    // Set canvas size to match the displayed image size
    canvas.width = displayWidth;
    canvas.height = displayHeight;

    // Set canvas style to match exactly
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw detection boxes
    if (analysisType === 'detection' && 'objects' in parsedResult && parsedResult.objects) {
      drawDetectionBoxes(ctx, parsedResult.objects, canvas.width, canvas.height);
    }
  }, [imageLoaded, parsedResult, analysisType, redrawTrigger, drawDetectionBoxes]);

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const downloadVisualization = useCallback(() => {
    if (!canvasRef.current || !imageRef.current || !parsedResult) {
      return;
    }

    // Create a new canvas for the final image
    const finalCanvas = document.createElement('canvas');
    const finalCtx = finalCanvas.getContext('2d');
    const image = imageRef.current;
    const overlayCanvas = canvasRef.current;

    if (!finalCtx) return;

    // Set final canvas size to match the original image dimensions
    finalCanvas.width = image.naturalWidth;
    finalCanvas.height = image.naturalHeight;

    // Draw the original image
    finalCtx.drawImage(image, 0, 0);

    // Scale and draw the overlay canvas
    const scaleX = image.naturalWidth / overlayCanvas.width;
    const scaleY = image.naturalHeight / overlayCanvas.height;
    
    // Save context state
    finalCtx.save();
    
    // Scale the overlay to match original image size
    finalCtx.scale(scaleX, scaleY);
    finalCtx.drawImage(overlayCanvas, 0, 0);
    
    // Restore context state
    finalCtx.restore();

    // Convert to blob and download
    finalCanvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `visualization_${analysisType}_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    }, 'image/png');
  }, [analysisType, parsedResult]);

  if (analysisType === 'general') {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">图片预览</label>
        <div className="border rounded-lg p-4 bg-gray-50">
          <img 
            src={imageUrl} 
            alt="Analysis result" 
            className="max-w-full max-h-96 mx-auto rounded-lg shadow-md object-contain"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">
          可视化结果 (物体检测)
        </label>
      </div>
      <div className="border rounded-lg p-4 bg-gray-50 relative">
        <div className="relative inline-block">
          <img
            ref={imageRef}
            src={imageUrl}
            alt="Analysis result"
            className="max-w-full max-h-96 rounded-lg shadow-md object-contain"
            onLoad={handleImageLoad}
            style={{ display: parsedResult ? 'block' : 'block' }}
          />
          {parsedResult && (
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 rounded-lg pointer-events-none"
            />
          )}
        </div>
        
        {!parsedResult && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 rounded-lg">
            <p className="text-gray-500 text-sm">无法解析可视化数据</p>
          </div>
        )}
      </div>
      
      {parsedResult && (
        <div className="mt-4 space-y-3">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-blue-900">检测结果统计</h4>
              <button
                onClick={downloadVisualization}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors"
              >
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                下载可视化结果
              </button>
            </div>
            {analysisType === 'detection' && 'objects' in parsedResult && parsedResult.objects && (
              <p className="text-sm text-blue-800">
                检测到 {parsedResult.objects.length} 个对象
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
