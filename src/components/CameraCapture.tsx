import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, RefreshCcw, Check, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CameraCaptureProps {
  onCapture: (blob: Blob, previewUrl: string) => void;
  onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setIsLoading(true);
    setError(null);
    setCapturedBlob(null);
    setCapturedPreview(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Kamera tidak didukung di browser ini.');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsLoading(false);
    } catch (err: any) {
      console.error('Camera Access Error:', err);
      setError(
        err.name === 'NotAllowedError' 
          ? 'Akses kamera ditolak. Silakan izinkan di pengaturan browser.' 
          : 'Gagal mengakses kamera. Pastikan perangkat memiliki kamera.'
      );
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Use actual video dimensions for high quality
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            setCapturedBlob(blob);
            setCapturedPreview(url);
            stopCamera();
          }
        }, 'image/jpeg', 0.95);
      }
    }
  };

  const handleRetake = () => {
    if (capturedPreview) {
      URL.revokeObjectURL(capturedPreview);
    }
    startCamera();
  };

  const handleUsePhoto = () => {
    if (capturedBlob && capturedPreview) {
      onCapture(capturedBlob, capturedPreview);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center overflow-hidden font-sans">
      <div className="relative w-full h-full max-w-4xl mx-auto flex flex-col">
        {/* Header Overlay */}
        <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10 bg-gradient-to-b from-black/60 to-transparent">
          <h3 className="text-white font-bold tracking-tight">Kamera Barang</h3>
          <button 
            onClick={onClose}
            className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-all active:scale-95"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Camera Preview Area */}
        <div className="flex-1 relative flex items-center justify-center bg-zinc-900 overflow-hidden">
          {isLoading && (
            <div className="flex flex-col items-center gap-4 text-white">
              <Loader2 className="w-10 h-10 animate-spin text-gray-400" />
              <p className="text-sm font-medium animate-pulse">Menyiapkan Kamera...</p>
            </div>
          )}

          {error ? (
            <div className="p-8 text-center max-w-sm">
              <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-10 h-10 text-red-500" />
              </div>
              <h4 className="text-white text-xl font-bold mb-3">Terjadi Kesalahan</h4>
              <p className="text-gray-400 text-sm mb-8 leading-relaxed">{error}</p>
              <button 
                onClick={onClose}
                className="w-full bg-white text-black py-4 rounded-2xl font-bold active:scale-95 transition-all"
              >
                Tutup & Gunakan Galeri
              </button>
            </div>
          ) : (
            <>
              {capturedPreview ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 1.1 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full h-full"
                >
                  <img 
                    src={capturedPreview} 
                    alt="Captured" 
                    className="w-full h-full object-contain md:object-cover" 
                  />
                </motion.div>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-contain md:object-cover transition-opacity duration-500 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                />
              )}
            </>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Controls Overlay */}
        {!error && !isLoading && (
          <div className="p-8 pb-12 md:pb-8 flex justify-center items-center gap-8 bg-gradient-to-t from-black/80 to-transparent absolute bottom-0 left-0 right-0">
            {capturedPreview ? (
              <div className="flex items-center gap-6 w-full max-w-md justify-center">
                <button
                  onClick={handleRetake}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center text-white backdrop-blur-md hover:bg-white/20 transition-all border border-white/20">
                    <RefreshCcw className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold text-white uppercase tracking-widest opacity-60 group-hover:opacity-100">Ulangi</span>
                </button>
                
                <button
                  onClick={handleUsePhoto}
                  className="flex-1 bg-black border-2 border-white text-white h-16 rounded-full flex items-center justify-center gap-3 font-bold text-lg active:scale-95 transition-all hover:bg-white hover:text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                >
                  <Check className="w-6 h-6" />
                  <span>Gunakan Foto</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <button
                  onClick={capturePhoto}
                  className="w-20 h-20 bg-white rounded-full flex items-center justify-center group active:scale-90 transition-all shadow-[0_0_30px_rgba(255,255,255,0.3)] border-4 border-white/50 relative"
                >
                  <div className="w-16 h-16 border-2 border-black/10 rounded-full flex items-center justify-center">
                    <Camera className="w-8 h-8 text-black" />
                  </div>
                  {/* Shutter visual effect */}
                  <div className="absolute inset-0 bg-black/5 rounded-full scale-0 group-active:scale-100 transition-transform duration-75" />
                </button>
                <span className="text-[10px] font-bold text-white uppercase tracking-widest opacity-60">Tekan untuk Memfoto</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
