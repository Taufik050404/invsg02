import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Package, Hash, Save, AlertCircle, Camera, Image as ImageIcon, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InventoryItem } from '../types';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => Promise<void>;
  editItem?: InventoryItem | null;
}

export default function InventoryModal({ isOpen, onClose, onSave, editItem }: InventoryModalProps) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState<number>(0);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | Blob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [showSourceChoice, setShowSourceChoice] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (editItem) {
      setName(editItem.name);
      setQuantity(editItem.quantity);
      setImagePreview(editItem.imageUrl);
      setImageFile(null);
    } else {
      setName('');
      setQuantity(0);
      setImagePreview(null);
      setImageFile(null);
    }
    setIsCameraActive(false);
    setShowSourceChoice(false);
    setError(null);

    // Cleanup previous object URLs if they were created from Blobs
    return () => {
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [editItem, isOpen]);

  // Clean up stream on transition or close
  useEffect(() => {
    if (!isOpen || !isCameraActive) {
      stopCamera();
    }
  }, [isOpen, isCameraActive]);

  const startCamera = async () => {
    setError(null);
    // Explicitly check for mediaDevices support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Kamera tidak didukung di browser ini. Silakan gunakan galeri.');
      setShowSourceChoice(false);
      // Fallback: Open gallery automatically after a small delay
      setTimeout(() => fileInputRef.current?.click(), 1000);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }, 
        audio: false 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
      setShowSourceChoice(false);
    } catch (err: any) {
      console.error('Camera Error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Akses kamera ditolak. Silakan berikan izin di pengaturan browser.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('Kamera tidak ditemukan pada perangkat ini.');
      } else {
        setError('Gagal mengakses kamera. Silakan gunakan unggah galeri sebagai alternatif.');
      }
      setShowSourceChoice(false);
      // Fallback
      setTimeout(() => fileInputRef.current?.click(), 2000);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            // Clean up old preview if it was a blob
            if (imagePreview && imagePreview.startsWith('blob:')) {
              URL.revokeObjectURL(imagePreview);
            }
            const url = URL.createObjectURL(blob);
            setImagePreview(url);
            setImageFile(blob);
            stopCamera();
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate format
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setError('Format gambar tidak didukung. Gunakan JPG, PNG, atau WEBP.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
        return;
      }

      // Validate size (5MB as requested)
      if (file.size > 5 * 1024 * 1024) {
        setError('Ukuran gambar maksimal 5MB. Silakan kompres gambar Anda.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
        return;
      }

      // Clean up old preview if it was a blob
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
      
      const url = URL.createObjectURL(file);
      setImagePreview(url);
      setImageFile(file);
      setShowSourceChoice(false);
      
      // Reset input value to allow selecting the same file again if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || quantity < 0 || !imagePreview) {
      setError('Mohon lengkapi seluruh data termasuk gambar.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Pass the file object too if it exists
      await (onSave as any)({ name, quantity, imageUrl: imagePreview, imageFile });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan data.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div id="modal-container" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="bg-white rounded-3xl w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h2 className="text-xl font-bold tracking-tight text-gray-900">
                {editItem ? 'Edit Data Barang' : 'Tambah Barang Baru'}
              </h2>
              <button 
                id="close-modal-btn"
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <form id="inventory-form" onSubmit={handleSubmit} className="px-8 py-8 space-y-6 overflow-y-auto">
              {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Gambar Barang</label>
                
                <div id="image-container" className="relative">
                  {isCameraActive ? (
                    <div className="relative h-64 w-full bg-black rounded-2xl overflow-hidden shadow-inner">
                      <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
                        <button
                          type="button"
                          onClick={capturePhoto}
                          className="bg-white text-black p-4 rounded-full shadow-lg active:scale-95 transition-transform"
                        >
                          <Camera className="w-6 h-6" />
                        </button>
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="bg-red-500 text-white p-4 rounded-full shadow-lg active:scale-95 transition-transform"
                        >
                          <X className="w-6 h-6" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      id="image-display-zone"
                      className="relative h-64 w-full border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-3 overflow-hidden group"
                    >
                      {imagePreview ? (
                        <>
                          <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-4 transition-opacity">
                            <button
                              type="button"
                              onClick={() => setShowSourceChoice(true)}
                              className="bg-white text-black px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:scale-105 transition-transform"
                            >
                              <RefreshCcw className="w-4 h-4" />
                              Ganti
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-4">
                          {!showSourceChoice ? (
                            <button
                              type="button"
                              onClick={() => setShowSourceChoice(true)}
                              className="flex flex-col items-center gap-3 text-gray-400 hover:text-black transition-colors w-full h-full justify-center"
                            >
                              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:bg-gray-100 transition-colors">
                                <Upload className="w-8 h-8" />
                              </div>
                              <div className="text-center px-4">
                                <p className="text-sm font-bold text-gray-900">Ketuk untuk Upload Gambar</p>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mt-1">Kamera atau Galeri</p>
                              </div>
                            </button>
                          ) : (
                            <div className="flex items-center justify-center gap-2 md:gap-4 animate-in fade-in zoom-in duration-200">
                              <button
                                type="button"
                                onClick={startCamera}
                                className="flex flex-col items-center gap-2 p-4 md:p-6 rounded-2xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all active:scale-95 group/btn"
                              >
                                <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center text-white mb-1 group-hover/btn:scale-110 transition-transform">
                                  <Camera className="w-6 h-6" />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-widest">Kamera</span>
                              </button>
                              <div className="w-[1px] h-12 bg-gray-100" />
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex flex-col items-center gap-2 p-4 md:p-6 rounded-2xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all active:scale-95 group/btn"
                              >
                                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500 mb-1 group-hover/btn:scale-110 transition-transform">
                                  <ImageIcon className="w-6 h-6" />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-widest">Galeri</span>
                              </button>
                              <div className="w-[1px] h-12 bg-gray-100" />
                              <button
                                type="button"
                                onClick={() => setShowSourceChoice(false)}
                                className="flex flex-col items-center gap-2 p-4 md:p-6 rounded-2xl hover:bg-red-50 border border-transparent hover:border-red-100 transition-all active:scale-95 text-red-500 group/btn"
                              >
                                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-red-600 mb-1 group-hover/btn:scale-110 transition-transform">
                                  <X className="w-6 h-6" />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-widest">Batal</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <input 
                  id="image-input"
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageChange} 
                  className="hidden" 
                  accept="image/*" 
                />
                <input 
                  id="camera-input"
                  type="file" 
                  ref={cameraInputRef} 
                  onChange={handleImageChange} 
                  className="hidden" 
                  accept="image/*" 
                  capture="environment"
                />
                <canvas ref={canvasRef} className="hidden" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Nama Barang</label>
                  <div className="relative">
                    <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="item-name-input"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Contoh: Laptop Dell"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Jumlah</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="item-quantity-input"
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                      placeholder="0"
                      min="0"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  id="save-item-btn"
                  type="submit"
                  disabled={isLoading || isCameraActive}
                  className="w-full bg-black text-white py-4 rounded-2xl flex items-center justify-center gap-2 font-bold hover:bg-gray-800 disabled:bg-gray-400 transition-all shadow-xl shadow-black/10 active:scale-95"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      <span>{editItem ? 'Update Barang' : 'Simpan Barang'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
