import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Package, Hash, Save, AlertCircle, Camera, Image as ImageIcon, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import imageCompression from 'browser-image-compression';
import { InventoryItem } from '../types';
import CameraCapture from './CameraCapture';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> & { imageFile?: File | null }) => Promise<void>;
  editItem?: InventoryItem | null;
}

export default function InventoryModal({ isOpen, onClose, onSave, editItem }: InventoryModalProps) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [showSourceChoice, setShowSourceChoice] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editItem) {
      setName(editItem.name);
      setQuantity(String(editItem.quantity ?? 0));
      setImagePreview(editItem.imageUrl);
      setImageFile(null);
    } else {
      setName('');
      setQuantity('');
      setImagePreview(null);
      setImageFile(null);
    }
    setIsCameraActive(false);
    setShowSourceChoice(false);
    setError(null);
  }, [editItem, isOpen]);

  const handleClose = () => {
    if (isLoading) return;

    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(null);
    setImageFile(null);
    setIsCameraActive(false);
    onClose();
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Format gambar tidak didukung. Gunakan JPG, PNG, atau WEBP.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      return;
    }

    if (file.size > 6 * 1024 * 1024) {
      setError('Ukuran gambar maksimal 6 MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1280,
        useWebWorker: true,
      };

      const compressedBlob = await imageCompression(file, options);
      const compressedFile = new File(
        [compressedBlob],
        `upload-${Date.now()}.jpg`,
        { type: 'image/jpeg' }
      );

      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }

      const url = URL.createObjectURL(compressedFile);
      setImagePreview(url);
      setImageFile(compressedFile);
      setShowSourceChoice(false);
    } catch (err) {
      console.error('Compression Error:', err);
      setError('Gagal memproses gambar. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const handleCameraCapture = async (blob: Blob, previewUrl: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1280,
        useWebWorker: true,
      };

      const rawFile = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const compressedBlob = await imageCompression(rawFile, options);
      const compressedFile = new File(
        [compressedBlob],
        `camera-${Date.now()}.jpg`,
        { type: 'image/jpeg' }
      );

      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }

      const newUrl = URL.createObjectURL(compressedFile);
      setImagePreview(newUrl);
      setImageFile(compressedFile);
      setIsCameraActive(false);

      // Revoke preview sementara dari CameraCapture
      URL.revokeObjectURL(previewUrl);
    } catch (err) {
      console.error('Camera Capture Error:', err);
      setError('Gagal memproses foto dari kamera.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const parsedQuantity = Number(quantity);

    if (!name.trim()) {
      setError('Nama barang wajib diisi.');
      return;
    }
    if (!Number.isFinite(parsedQuantity) || quantity.trim() === '') {
      setError('Jumlah harus angka.');
      return;
    }
    if (parsedQuantity < 0) {
      setError('Jumlah tidak boleh negatif.');
      return;
    }
    if (!imagePreview) {
      setError('Gambar wajib ada.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onSave({ name: name.trim(), quantity: parsedQuantity, imageUrl: imagePreview, imageFile });

      setName('');
      setQuantity('');
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
      setImagePreview(null);
      setImageFile(null);

      onClose();
    } catch (err: any) {
      console.error('Submit error:', err);

      if (err.code === 'storage/unauthorized' || err.message?.includes('storage')) {
        setError('Upload gambar gagal. Periksa Firebase Storage rules.');
      } else if (err.code === 'permission-denied' || err.message?.includes('firestore')) {
        setError('Gagal menyimpan data barang. Periksa Firestore rules.');
      } else if (err.message?.includes('network') || err.message?.includes('fetch')) {
        setError('Koneksi terlalu lambat. Periksa koneksi internet Anda.');
      } else {
        setError(err.message ? `Gagal menyimpan barang. ${err.message}` : 'Gagal menyimpan barang. Coba lagi.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <div key="modal-container" id="modal-container" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="bg-white rounded-3xl w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h2 className="text-xl font-bold tracking-tight text-gray-900">
                {editItem ? 'Edit Data Barang' : 'Tambah Barang Baru'}
              </h2>
              <button
                id="close-modal-btn"
                onClick={handleClose}
                disabled={isLoading}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Form */}
            <form id="inventory-form" onSubmit={handleSubmit} className="px-8 py-8 space-y-6 overflow-y-auto">
              {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              {/* Image Section */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Gambar Barang</label>

                <div id="image-container" className="relative">
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
                            disabled={isLoading}
                            onClick={() => setShowSourceChoice(true)}
                            className="bg-white text-black px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:scale-105 transition-transform"
                          >
                            <RefreshCcw className="w-4 h-4" />
                            Ganti
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-4 w-full h-full justify-center">
                        {!showSourceChoice ? (
                          <button
                            type="button"
                            disabled={isLoading}
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
                              disabled={isLoading}
                              onClick={() => { setIsCameraActive(true); setShowSourceChoice(false); }}
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
                              disabled={isLoading}
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
                              disabled={isLoading}
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
              </div>

              {/* Name & Quantity */}
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
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="0"
                      min="0"
                      step="1"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  id="save-item-btn"
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-black text-white py-4 rounded-2xl flex items-center justify-center gap-2 font-bold hover:bg-gray-800 disabled:bg-gray-400 transition-all shadow-xl shadow-black/10 active:scale-95"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Menyimpan...</span>
                    </>
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

      {/* Camera overlay */}
      <AnimatePresence>
        {isCameraActive && (
          <CameraCapture
            key="camera-capture"
            onCapture={handleCameraCapture}
            onClose={() => setIsCameraActive(false)}
          />
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}
