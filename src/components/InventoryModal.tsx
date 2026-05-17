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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [showSourceChoice, setShowSourceChoice] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (editItem) {
      setName(editItem.name);
      setQuantity(editItem.quantity);
      setImagePreview(editItem.imageUrl);
    } else {
      setName('');
      setQuantity(0);
      setImagePreview(null);
    }
    setIsCameraActive(false);
    setShowSourceChoice(false);
  }, [editItem, isOpen]);

  // Clean up stream on close
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
  }, [isOpen]);

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
      setShowSourceChoice(false);
    } catch (err) {
      setError('Gagal mengakses kamera. Pastikan izin kamera telah diberikan.');
      console.error(err);
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
        const dataUrl = canvas.toDataURL('image/jpeg');
        setImagePreview(dataUrl);
        stopCamera();
      }
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError('Ukuran gambar maksimal 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setShowSourceChoice(false);
      };
      reader.readAsDataURL(file);
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
      await onSave({ name, quantity, imageUrl: imagePreview });
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
                              className="flex flex-col items-center gap-3 text-gray-400 hover:text-black transition-colors"
                            >
                              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:bg-gray-100 transition-colors">
                                <Upload className="w-8 h-8" />
                              </div>
                              <div className="text-center">
                                <p className="text-sm font-bold text-gray-900">Pilih Gambar Barang</p>
                                <p className="text-xs text-gray-500">Kamera atau Galeri</p>
                              </div>
                            </button>
                          ) : (
                            <div className="flex items-center gap-4 animate-in fade-in zoom-in duration-200">
                              <button
                                type="button"
                                onClick={startCamera}
                                className="flex flex-col items-center gap-2 p-6 rounded-2xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all"
                              >
                                <Camera className="w-8 h-8 text-black" />
                                <span className="text-xs font-bold uppercase tracking-widest">Kamera</span>
                              </button>
                              <div className="w-[1px] h-12 bg-gray-100" />
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex flex-col items-center gap-2 p-6 rounded-2xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all"
                              >
                                <ImageIcon className="w-8 h-8 text-black" />
                                <span className="text-xs font-bold uppercase tracking-widest">File</span>
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
