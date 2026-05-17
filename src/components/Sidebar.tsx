import React from 'react';
import { LayoutDashboard, Package, LogOut, Settings, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'inventory', label: 'Inventaris', icon: Package },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'about', label: 'Tentang', icon: Info },
];

export default function Sidebar({ activeTab, setActiveTab, onLogout, isOpen, onClose }: SidebarProps) {
  const handleItemClick = (id: string) => {
    setActiveTab(id);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[50] lg:hidden"
          />
        )}
      </AnimatePresence>

      <div 
        id="sidebar" 
        className={cn(
          "fixed inset-y-0 left-0 z-[60] w-72 bg-[#141414] text-white flex flex-col border-r border-[#2a2a2a] transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <Package className="text-black w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight">INVSG02</span>
          </div>
          
          <button 
            onClick={onClose}
            className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              id={`menu-item-${item.id}`}
              onClick={() => handleItemClick(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-4 rounded-xl transition-all duration-200 group",
                activeTab === item.id 
                  ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.1)]" 
                  : "text-gray-400 hover:text-white hover:bg-[#1a1a1a]"
              )}
            >
              <item.icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", activeTab === item.id ? "text-black" : "text-gray-400")} />
              <span className="font-bold tracking-tight">{item.label}</span>
              {activeTab === item.id && (
                <motion.div
                  layoutId="active-pill"
                  className="ml-auto w-1.5 h-1.5 rounded-full bg-black"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          ))}
        </nav>

        <div className="p-6 mt-auto border-t border-[#2a2a2a]">
          <button
            id="logout-button"
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-4 text-gray-400 hover:text-red-400 hover:bg-red-950/20 rounded-xl transition-all group"
          >
            <LogOut className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
            <span className="font-bold tracking-tight">Logout</span>
          </button>
        </div>
      </div>
    </>
  );
}
