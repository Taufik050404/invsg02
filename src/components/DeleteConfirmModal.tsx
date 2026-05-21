import React from 'react';
import { X, AlertTriangle, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  itemName: string;
  isLoading: boolean;
}

export default function DeleteConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  itemName,
  isLoading 
}: DeleteConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div id="delete-modal-container" className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={!isLoading ? onClose : undefined}
            data-app-backdrop="true"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl relative overflow-hidden p-8 text-center"
          >
            <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-red-500">
              <AlertTriangle className="w-10 h-10" />
            </div>

            <h3 className="text-xl font-black tracking-tight text-gray-900 mb-2">Konfirmasi Hapus</h3>
            <p className="text-gray-500 mb-8 leading-relaxed">
              Apakah Anda yakin ingin menghapus data barang <span className="font-bold text-gray-900">"{itemName}"</span> ini? Aksi ini tidak dapat dibatalkan.
            </p>

            <div className="flex flex-col gap-3">
              <button
                id="confirm-delete-btn"
                onClick={onConfirm}
                disabled={isLoading}
                className="w-full bg-red-500 text-white py-4 rounded-2xl flex items-center justify-center gap-2 font-bold hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400 transition-all shadow-lg shadow-red-500/20 active:scale-95"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-5 h-5" />
                    <span>Ya, Hapus</span>
                  </>
                )}
              </button>
              
              <button
                id="cancel-delete-btn"
                onClick={onClose}
                disabled={isLoading}
                className="w-full bg-white text-gray-400 py-4 rounded-2xl font-bold hover:bg-gray-50 hover:text-gray-900 transition-all active:scale-95"
              >
                Batal
              </button>
            </div>

            <button 
              onClick={onClose}
              disabled={isLoading}
              className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-300 hover:text-gray-900"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
