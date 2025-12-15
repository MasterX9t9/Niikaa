import React, { useRef, useEffect, useState } from 'react';
import { IconCheck, IconX, IconTrash, IconUndo } from './Icons';

interface ImageMaskEditorProps {
  imageUrl: string;
  onSave: (maskDataUrl: string) => void;
  onCancel: () => void;
}

export const ImageMaskEditor: React.FC<ImageMaskEditorProps> = ({ imageUrl, onSave, onCancel }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  const [imgDimensions, setImgDimensions] = useState({ width: 0, height: 0 });

  // Load image to get dimensions and set canvas size
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
        // Calculate aspect ratio preserving dimensions that fit in the container
        // But for the mask to match, we ideally want the canvas to match the displayed image size
        // OR the canvas matches the actual image size. 
        // Matching actual image size is better for resolution.
        setImgDimensions({ width: img.width, height: img.height });
        
        // Initialize canvas
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // Clear with transparent
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                // Fill with black (fully transparent logic or black logic?)
                // Gemini usually expects a black/white mask image where white is "edit this".
                // Let's assume we send a black background image with white strokes.
                ctx.fillStyle = "black";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        }
    };
  }, [imageUrl]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); // Prevent scrolling on touch
    setIsDrawing(true);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
        const { x, y } = getCoordinates(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.strokeStyle = "white";
        ctx.lineWidth = brushSize;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineTo(x, y); // Draw a dot
        ctx.stroke();
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
     e.preventDefault(); // Prevent scrolling
     if (!isDrawing) return;
     const ctx = canvasRef.current?.getContext('2d');
     if (ctx) {
         const { x, y } = getCoordinates(e);
         ctx.lineTo(x, y);
         ctx.stroke();
     }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
        ctx.closePath();
    }
  };

  const handleClear = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
          ctx.fillStyle = "black";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
  };

  const handleSave = () => {
      const canvas = canvasRef.current;
      if (canvas) {
          onSave(canvas.toDataURL('image/png'));
      }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center p-4">
        {/* Header */}
        <div className="w-full max-w-lg flex justify-between items-center mb-4 text-white">
            <h3 className="font-bold text-lg">Paint Area to Edit</h3>
            <button onClick={onCancel} className="p-2 bg-white/10 rounded-full hover:bg-white/20">
                <IconX className="w-5 h-5" />
            </button>
        </div>

        {/* Canvas Container */}
        <div 
            ref={containerRef}
            className="relative w-full max-w-lg aspect-square bg-gray-900 border border-gray-700 rounded-lg overflow-hidden touch-none"
        >
            {/* Background Image */}
            <img 
                src={imageUrl} 
                alt="Original" 
                className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none" 
            />
            
            {/* Drawing Canvas (Overlay) */}
            <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="absolute inset-0 w-full h-full object-contain opacity-60 cursor-crosshair"
                style={{ width: '100%', height: '100%' }} // CSS sizing to match container
            />
        </div>

        {/* Controls */}
        <div className="w-full max-w-lg mt-6 flex flex-col gap-4">
             {/* Brush Size */}
             <div className="flex items-center gap-4 text-white">
                 <span className="text-sm font-medium">Size</span>
                 <input 
                    type="range" 
                    min="10" 
                    max="100" 
                    value={brushSize} 
                    onChange={(e) => setBrushSize(parseInt(e.target.value))}
                    className="flex-1 accent-primary-500"
                 />
             </div>

             {/* Actions */}
             <div className="flex justify-between items-center gap-4">
                 <button 
                    onClick={handleClear}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors font-medium text-sm"
                 >
                     <IconTrash className="w-4 h-4" />
                     Clear
                 </button>

                 <button 
                    onClick={handleSave}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors font-bold"
                 >
                     <IconCheck className="w-5 h-5" />
                     Confirm Selection
                 </button>
             </div>
        </div>
    </div>
  );
};