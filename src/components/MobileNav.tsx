import React from 'react';
import { Home, Search, Library, Users, Settings } from 'lucide-react';
import { usePlayer } from '@/context/PlayerContext';
import { cn } from '@/lib/utils';

export function MobileNav() {
  const { setJamModalOpen, setSettingsModalOpen, sessionId } = usePlayer();

  return (
    <div className="md:hidden bg-[#121212] border-t border-[#282828] px-6 py-3 flex items-center justify-between text-[#b3b3b3]">
      <div className="flex flex-col items-center gap-1 cursor-pointer hover:text-white transition">
        <Home size={24} />
        <span className="text-[10px]">Home</span>
      </div>
      
      <div className="flex flex-col items-center gap-1 cursor-pointer hover:text-white transition">
        <Search size={24} />
        <span className="text-[10px]">Search</span>
      </div>

      <div className="flex flex-col items-center gap-1 cursor-pointer hover:text-white transition">
        <Library size={24} />
        <span className="text-[10px]">Library</span>
      </div>

      <div 
        onClick={() => setJamModalOpen(true)}
        className={cn("flex flex-col items-center gap-1 cursor-pointer transition", sessionId ? "text-green-500" : "hover:text-white")}
      >
        <Users size={24} />
        <span className="text-[10px]">Jam</span>
      </div>

      <div 
        onClick={() => setSettingsModalOpen(true)}
        className="flex flex-col items-center gap-1 cursor-pointer hover:text-white transition"
      >
        <Settings size={24} />
        <span className="text-[10px]">Settings</span>
      </div>
    </div>
  );
}
