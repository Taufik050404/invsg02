import React from 'react';
import { Search, Bell, User, Menu } from 'lucide-react';
import { auth } from '../lib/firebase';

interface NavbarProps {
  onMenuClick: () => void;
}

export default function Navbar({ onMenuClick }: NavbarProps) {
  const user = auth.currentUser;

  return (
    <header id="navbar" className="h-20 bg-white border-bottom border-gray-100 px-4 md:px-8 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-4 flex-1">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-gray-100 rounded-xl transition-all"
        >
          <Menu className="w-6 h-6" />
        </button>

        <div className="relative w-full max-w-xs md:max-w-sm hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            id="search-input"
            type="text"
            placeholder="Cari data..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-6">
        <button id="notification-button" className="text-gray-400 hover:text-black transition-colors relative p-2 md:p-0">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 md:top-0 right-1 md:right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        
        <div className="h-8 w-[1px] bg-gray-200 mx-1 md:mx-2"></div>
        
        <div id="user-profile" className="flex items-center gap-2 md:gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold">Admin INVSG02</p>
            <p className="text-xs text-gray-500 capitalize">Administrator</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center border border-gray-200 overflow-hidden text-white shadow-lg shadow-black/10">
            <User className="w-5 h-5" />
          </div>
        </div>
      </div>
    </header>
  );
}
