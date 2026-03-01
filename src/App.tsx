import React from 'react';
import { Sidebar } from './components/Sidebar';
import { Player } from './components/Player';
import { MainView } from './components/MainView';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { GlobalPlayer } from './components/GlobalPlayer';
import { MobileNav } from './components/MobileNav';
import { JamModal } from './components/JamModal';
import { SettingsModal } from './components/SettingsModal';

function AppContent() {
  const { isJamModalOpen, setJamModalOpen, isSettingsModalOpen, setSettingsModalOpen } = usePlayer();

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden font-sans select-none">
      <div className="flex-1 flex gap-2 p-2 overflow-hidden relative">
        <Sidebar />
        <MainView />
      </div>
      <Player />
      <MobileNav />
      <GlobalPlayer />
      
      {isJamModalOpen && <JamModal onClose={() => setJamModalOpen(false)} />}
      {isSettingsModalOpen && <SettingsModal onClose={() => setSettingsModalOpen(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <PlayerProvider>
      <AppContent />
    </PlayerProvider>
  );
}
