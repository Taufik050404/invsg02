/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { Plus, Download, Edit2, Trash2, ChevronLeft, ChevronRight, Package2 } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { format as formatDate } from 'date-fns';

import { db, storage } from './lib/firebase';
import { InventoryItem, OperationType } from './types';
import { exportToPDF, exportToWord, exportToExcel } from './lib/exportUtils';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import InventoryModal from './components/InventoryModal';
import DeleteConfirmModal from './components/DeleteConfirmModal';
import LoginForm from './components/LoginForm';

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo.error;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal membaca gambar.'));
    reader.readAsDataURL(file);
  });
}

function normalizeItem(id: string, data: any): InventoryItem {
  return {
    id,
    name: typeof data.name === 'string' ? data.name : '',
    quantity: Number.isFinite(Number(data.quantity)) ? Number(data.quantity) : 0,
    imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : '',
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? data.createdAt ?? null,
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
  };
}

export default function App() {
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('inventory');
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // Storage key for session
  const AUTH_KEY = 'invsg02_authenticated';

  // Delete Modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const itemsPerPage = 6;

  useEffect(() => {
    const isAuthenticated = localStorage.getItem(AUTH_KEY) === 'true';
    if (isAuthenticated) {
      setUser({ uid: 'admin_session' });
    } else {
      setUser(null);
    }
  }, []);

  const handleExport = async (type: 'pdf' | 'excel' | 'word') => {
    if (items.length === 0) {
      toast.error('Tidak ada data untuk diekspor');
      return;
    }
    
    setIsExporting(true);
    const toastId = toast.loading(`Menyiapkan file ${type.toUpperCase()}...`);
    
    try {
      if (type === 'pdf') await exportToPDF(items);
      else if (type === 'excel') await exportToExcel(items);
      else if (type === 'word') await exportToWord(items);
      
      toast.success(`File ${type.toUpperCase()} berhasil diunduh`, { id: toastId });
    } catch (error) {
      console.error('Export Error:', error);
      toast.error(`Gagal mengekspor ke ${type.toUpperCase()}`, { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }

    const q = query(collection(db, 'items'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((snapshotDoc) => normalizeItem(snapshotDoc.id, snapshotDoc.data()));
      setItems(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'items');
      toast.error('Gagal memuat data inventaris', { id: 'items-list-error' });
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogin = async (username: string, password: string) => {
    setIsLoggingIn(true);
    try {
      // Direct username/password check as requested (admin / admin123)
      if (username === 'admin' && password === 'admin123') {
        localStorage.setItem(AUTH_KEY, 'true');
        setUser({ uid: 'admin_session' });
        toast.success('Selamat datang, Admin!');
      } else {
        throw new Error('Username atau password salah');
      }
    } catch (error: any) {
      toast.error(error.message || 'Gagal login.');
      throw error;
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem(AUTH_KEY);
      setUser(null);
      toast.success('Sudah keluar dari sistem.');
    } catch (error) {
      toast.error('Gagal logout.');
    }
  };

  const saveItem = async (data: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> & { imageFile?: File | null }) => {
    if (!user) {
      throw new Error('Session tidak ditemukan. Silakan login kembali.');
    }

    const itemName = data.name.trim();
    const itemQuantity = Number(data.quantity);

    if (!itemName) {
      throw new Error('Nama barang wajib diisi.');
    }

    if (!Number.isFinite(itemQuantity) || itemQuantity < 0) {
      throw new Error('Jumlah harus angka valid.');
    }

    if (!data.imageUrl && !data.imageFile) {
      throw new Error('Gambar barang wajib ada.');
    }

    const toastId = 'inventory-save';
    toast.loading(editingItem ? 'Memperbarui barang...' : 'Menyimpan barang...', { id: toastId });

    const uploadImageInBackground = async (itemId: string, file: File) => {
      try {
        const timestamp = Date.now();
        const safeName = itemName.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 40) || 'barang';
        const storageRef = ref(storage, `inventory/${itemId}-${timestamp}-${safeName}.jpg`);

        const uploadResult = await withTimeout(
          uploadBytes(storageRef, file, {
            contentType: file.type || 'image/jpeg',
            cacheControl: 'public,max-age=31536000',
          }),
          12000,
          'Background upload timeout.'
        );

        const storageUrl = await withTimeout(
          getDownloadURL(uploadResult.ref),
          5000,
          'Background URL timeout.'
        );

        await updateDoc(doc(db, 'items', itemId), {
          imageUrl: storageUrl,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        console.warn('Upload Storage dilewati, gambar data URL tetap dipakai:', error);
      }
    };

    try {
      let imageUrl = data.imageUrl;

      if (data.imageFile) {
        imageUrl = await withTimeout(
          fileToDataUrl(data.imageFile),
          3000,
          'Gagal menyiapkan gambar.'
        );
      }

      const now = serverTimestamp();
      const itemData = {
        name: itemName,
        quantity: itemQuantity,
        imageUrl,
        updatedAt: now,
      };

      if (editingItem) {
        const itemDoc = doc(db, 'items', editingItem.id);
        await withTimeout(
          updateDoc(itemDoc, itemData),
          8000,
          'Request update database terlalu lama.'
        );
        toast.success('Barang berhasil diperbarui', { id: toastId });
        if (data.imageFile) {
          void uploadImageInBackground(editingItem.id, data.imageFile);
        }
      } else {
        const docRef = await withTimeout(
          addDoc(collection(db, 'items'), {
            ...itemData,
            createdAt: now,
            createdBy: user.uid,
          }),
          8000,
          'Request simpan database terlalu lama.'
        );
        toast.success('Barang berhasil disimpan', { id: toastId });
        if (data.imageFile) {
          void uploadImageInBackground(docRef.id, data.imageFile);
        }
      }

      setCurrentPage(1);
    } catch (error: any) {
      console.error('Save Error:', error);
      let errorMessage = 'Gagal menyimpan barang';

      if (error.code === 'storage/unauthorized') {
        errorMessage = 'Upload gambar gagal. Periksa Firebase Storage rules.';
      } else if (error.code === 'permission-denied') {
        errorMessage = 'Gagal menyimpan data barang. Periksa Firestore rules.';
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage = 'Koneksi terlalu lambat. Periksa internet Anda.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage, { id: toastId });
      throw error;
    }
  };

  const deleteItem = (item: InventoryItem) => {
    setItemToDelete(item);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    
    setIsDeleting(true);
    const toastId = 'inventory-delete';
    try {
      await withTimeout(
        deleteDoc(doc(db, 'items', itemToDelete.id)),
        15000,
        'Request hapus database terlalu lama.'
      );
      toast.success('Data barang berhasil dihapus', { id: toastId });
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `items/${itemToDelete.id}`);
      toast.error('Gagal menghapus data barang', { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => 
      item.name.toLowerCase().includes(searchTerm.trim().toLowerCase())
    );
  }, [items, searchTerm]);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  if (!user) {
    return (
      <>
        <Toaster position="top-right" />
        <LoginForm onLogin={handleLogin} isLoading={isLoggingIn} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col lg:flex-row font-sans">
      <Toaster position="top-right" />
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />
      
      <div className="flex-1 flex flex-col min-h-screen">
        <main className="flex-1 flex flex-col">
          <Navbar onMenuClick={() => setIsSidebarOpen(true)} />
          
          <div className="p-4 md:p-8 lg:p-10 flex-1">
            <div className="max-w-6xl mx-auto space-y-8 md:space-y-10">
              {/* Header Area */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h1 className="text-3xl md:text-4xl font-black tracking-tight text-gray-900 mb-2">INVSG02</h1>
                  <p className="text-sm md:text-base text-gray-500 font-medium tracking-tight">Sistem Inventaris dan Pendataan Barang</p>
                </div>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="dropdown relative group">
                    <button 
                      disabled={isExporting}
                      className="w-full sm:w-auto bg-white border border-gray-200 h-[52px] px-6 rounded-2xl flex items-center justify-center gap-2 font-bold hover:bg-gray-50 transition-all shadow-sm active:scale-95 disabled:bg-gray-50 disabled:text-gray-400"
                    >
                      {isExporting ? (
                        <div className="w-5 h-5 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                      ) : (
                        <Download className="w-5 h-5 text-gray-400" />
                      )}
                      <span>Ekspor Data</span>
                    </button>
                    {!isExporting && (
                      <div className="absolute right-0 top-full mt-2 w-full sm:w-48 bg-white border border-gray-100 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 flex flex-col overflow-hidden">
                        <button onClick={() => handleExport('pdf')} className="px-5 py-4 text-left text-sm font-bold hover:bg-gray-50 transition-colors border-b border-gray-50 flex items-center gap-3">
                          <span className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center text-red-500 text-xs">PDF</span>
                          Download PDF
                        </button>
                        <button onClick={() => handleExport('excel')} className="px-5 py-4 text-left text-sm font-bold hover:bg-gray-50 transition-colors border-b border-gray-50 flex items-center gap-3">
                          <span className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-500 text-xs">XLS</span>
                          Download Excel
                        </button>
                        <button onClick={() => handleExport('word')} className="px-5 py-4 text-left text-sm font-bold hover:bg-gray-50 transition-colors flex items-center gap-3">
                          <span className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500 text-xs">DOC</span>
                          Download Word
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
                    className="bg-black text-white h-[52px] px-8 rounded-2xl flex items-center justify-center gap-2 font-bold hover:bg-gray-800 transition-all shadow-xl shadow-black/10 active:scale-95"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Tambah Barang</span>
                  </button>
                </div>
              </div>

              {/* Stats Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {[
                  { label: 'Total Barang', value: items.length, icon: Package2, color: 'bg-blue-600' },
                  { label: 'Total Unit', value: items.reduce((acc, curr) => acc + Number(curr.quantity || 0), 0), icon: Package2, color: 'bg-indigo-600' },
                  { label: 'Kategori', value: 'Umum', icon: Package2, color: 'bg-emerald-600' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-6 md:p-8 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4 md:gap-6 group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div className={`${stat.color} w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0`}>
                      <stat.icon className="w-6 h-6 md:w-7 md:h-7" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest truncate">{stat.label}</p>
                      <p className="text-2xl md:text-3xl font-black text-gray-900 leading-tight">{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Main Table container */}
              <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                <div className="p-6 md:p-8 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h3 className="text-base md:text-lg font-bold text-gray-800 uppercase tracking-tight">Daftar Barang Terbaru</h3>
                  <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100 w-full sm:w-auto">
                    <input 
                      type="text" 
                      placeholder="Cari kata kunci..." 
                      value={searchTerm}
                      className="bg-transparent border-none text-sm px-4 py-2 focus:ring-0 w-full sm:w-60"
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                    />
                  </div>
                </div>
                
                <div className="overflow-x-auto scrollbar-hide">
                  <table className="w-full text-left min-w-[700px]">
                    <thead>
                      <tr className="bg-gray-50/50">
                        <th className="px-6 md:px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest w-16">No</th>
                        <th className="px-6 md:px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest w-24">Gambar</th>
                        <th className="px-6 md:px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nama Barang</th>
                        <th className="px-6 md:px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Jumlah</th>
                        <th className="px-6 md:px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-sm md:text-base">
                      <AnimatePresence mode="popLayout">
                        {paginatedItems.map((item, index) => (
                          <motion.tr 
                            key={item.id}
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="hover:bg-gray-50/70 transition-colors group"
                          >
                            <td className="px-6 md:px-8 py-6">
                              <span className="text-xs md:text-sm font-bold text-gray-300 group-hover:text-gray-500 transition-colors">#{(currentPage - 1) * itemsPerPage + index + 1}</span>
                            </td>
                            <td className="px-6 md:px-8 py-6">
                              <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 shadow-sm transition-all group-hover:scale-105 group-hover:shadow-md">
                                {item.imageUrl ? (
                                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Package2 className="w-6 h-6 text-gray-300" />
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 md:px-8 py-6">
                              <p className="font-bold text-gray-900 mb-0.5 line-clamp-1">{item.name}</p>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Update: {format(item.updatedAt, 'dd MMM yyyy')}</p>
                            </td>
                            <td className="px-6 md:px-8 py-6 text-center">
                              <div className={`inline-flex items-center px-4 py-1.5 rounded-full text-[10px] md:text-xs font-bold ${
                                item.quantity > 10 ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'
                              }`}>
                                {item.quantity} Unit
                              </div>
                            </td>
                            <td className="px-6 md:px-8 py-6 text-right">
                              <div className="flex items-center justify-end gap-1 md:gap-2">
                                <button
                                  onClick={() => { setEditingItem(item); setIsModalOpen(true); }}
                                  className="p-3 text-gray-400 hover:text-black hover:bg-white rounded-xl transition-all shadow-none hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] active:scale-90"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => deleteItem(item)}
                                  className="p-3 text-gray-400 hover:text-red-500 hover:bg-white rounded-xl transition-all shadow-none hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] active:scale-90"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                      {filteredItems.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 md:px-8 py-24 text-center text-gray-400">
                            <div className="flex flex-col items-center gap-4">
                              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center">
                                <Package2 className="w-10 h-10 text-gray-200" />
                              </div>
                              <p className="font-bold tracking-tight">Belum ada data barang.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="p-6 md:p-8 border-t border-gray-50 flex flex-col md:flex-row items-center justify-between gap-6">
                    <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest order-2 md:order-1">
                      Menampilkan <span className="text-gray-900">{paginatedItems.length}</span> / <span className="text-gray-900">{filteredItems.length}</span> Barang
                    </p>
                    <div className="flex items-center gap-2 order-1 md:order-2">
                      <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-2.5 md:p-3 border border-gray-100 rounded-xl hover:bg-gray-50 disabled:opacity-30 transition-all font-bold text-gray-600 shadow-sm"
                      >
                        <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
                      </button>
                      <div className="flex items-center gap-1.5 mx-2">
                        {[...Array(totalPages)].map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setCurrentPage(i + 1)}
                            className={`w-9 h-9 md:w-11 md:h-11 rounded-xl text-xs md:text-sm font-black transition-all ${
                              currentPage === i + 1 ? 'bg-black text-white shadow-xl shadow-black/10 scale-105' : 'text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {i + 1}
                          </button>
                        ))}
                      </div>
                      <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2.5 md:p-3 border border-gray-100 rounded-xl hover:bg-gray-50 disabled:opacity-30 transition-all font-bold text-gray-600 shadow-sm"
                      >
                        <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <footer className="bg-white border-t border-gray-100 py-10 px-6 md:px-10 text-center md:text-left text-sm text-gray-400 mt-auto shrink-0 transition-opacity">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex flex-col items-center md:items-start gap-1">
                <p className="font-bold text-gray-900 tracking-tight text-lg">INVSG02</p>
                <p className="font-medium text-xs">&copy; {new Date().getFullYear()} All rights reserved.</p>
              </div>
              <div className="flex flex-wrap justify-center gap-4 md:gap-8 font-bold text-xs uppercase tracking-widest">
                <a href="#" className="hover:text-black transition-colors">Privacy</a>
                <a href="#" className="hover:text-black transition-colors">Terms</a>
                <a href="#" className="hover:text-black transition-colors">Support</a>
              </div>
            </div>
          </footer>
        </main>
      </div>

      <InventoryModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingItem(null); }}
        onSave={saveItem}
        editItem={editingItem}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        itemName={itemToDelete?.name || ''}
        isLoading={isDeleting}
      />
    </div>
  );
}

function format(timestamp: any, formatStr: string) {
  if (!timestamp) return '-';
  
  // Handle Firestore Timestamp
  if (timestamp && typeof timestamp.toDate === 'function') {
    return formatDate(timestamp.toDate(), formatStr);
  }
  
  // Handle Number/String
  try {
    return formatDate(new Date(timestamp), formatStr);
  } catch (e) {
    return '-';
  }
}
