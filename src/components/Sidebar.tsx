import React, { useState, useRef } from 'react';
import { Home, Search, Library, Plus, Heart, ArrowRight, Music2, Users, Copy, Check, Settings, Volume2, Bug } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlayer } from '@/context/PlayerContext';

export function Sidebar() {
  const { sessionId, participantCount, setJamModalOpen, setSettingsModalOpen, isJamModalOpen, isSettingsModalOpen } = usePlayer();

  return (
    <div className="hidden md:flex w-64 bg-black h-full flex-col gap-2 p-2 text-[#b3b3b3]">
      {/* Home / Search Nav */}
      <div className="bg-[#121212] rounded-lg p-4 flex flex-col gap-4">
        <div className="flex items-center gap-4 text-white cursor-pointer hover:text-white transition">
          <Home size={24} />
          <span className="font-bold">Home</span>
        </div>
        <div className="flex items-center gap-4 cursor-pointer hover:text-white transition">
          <Search size={24} />
          <span className="font-bold">Search</span>
        </div>
      </div>

      {/* Library */}
      <div className="bg-[#121212] flex-1 rounded-lg flex flex-col">
        <div className="p-4 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2 hover:text-white cursor-pointer transition">
            <Library size={24} />
            <span className="font-bold">Your Library</span>
          </div>
          <div className="flex items-center gap-2">
            <Plus size={20} className="hover:text-white cursor-pointer" />
            <ArrowRight size={20} className="hover:text-white cursor-pointer" />
          </div>
        </div>

        {/* Playlists / Chips */}
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
          <span className="bg-[#232323] px-3 py-1 rounded-full text-sm text-white cursor-pointer hover:bg-[#2a2a2a]">Playlists</span>
          <span className="bg-[#232323] px-3 py-1 rounded-full text-sm text-white cursor-pointer hover:bg-[#2a2a2a]">Artists</span>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2">
          <div className="p-2 hover:bg-[#1a1a1a] rounded-md flex items-center gap-3 cursor-pointer group">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-md flex items-center justify-center text-white">
              <Heart size={20} fill="white" />
            </div>
            <div className="flex flex-col">
              <span className="text-white font-medium group-hover:text-green-500 transition">Liked Songs</span>
              <span className="text-sm">Playlist • 123 songs</span>
            </div>
          </div>
          
          {/* Jam Session Button */}
          <div 
            onClick={() => setJamModalOpen(true)}
            className={cn(
              "mt-4 p-2 rounded-md flex items-center gap-3 cursor-pointer group border transition-all",
              sessionId 
                ? "bg-green-500/10 border-green-500/50 hover:bg-green-500/20" 
                : "hover:bg-[#1a1a1a] border-transparent"
            )}
          >
            <div className={cn(
              "w-12 h-12 rounded-md flex items-center justify-center transition-colors",
              sessionId ? "text-green-500" : "bg-[#282828] text-gray-400 group-hover:text-white"
            )}>
              <Users size={20} />
            </div>
            <div className="flex flex-col">
              <span className={cn("font-medium transition", sessionId ? "text-green-500" : "text-white")}>
                {sessionId ? 'Jam Active' : 'Start a Jam'}
              </span>
              <span className={cn("text-xs", sessionId ? "text-green-400" : "text-gray-400")}>
                {sessionId ? `${participantCount} listening` : 'Listen together'}
              </span>
            </div>
          </div>

          {/* Settings Button */}
          <div 
            onClick={() => setSettingsModalOpen(true)}
            className="mt-2 p-2 hover:bg-[#1a1a1a] rounded-md flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-12 h-12 bg-[#282828] rounded-md flex items-center justify-center text-gray-400 group-hover:text-white transition-colors">
              <Settings size={20} />
            </div>
            <div className="flex flex-col">
              <span className="text-white font-medium">Settings & Debug</span>
              <span className="text-xs text-gray-400">Fix audio issues</span>
            </div>
          </div>
        </div>
      </div>
      
      {isJamModalOpen && <JamModal onClose={() => setJamModalOpen(false)} />}
      {isSettingsModalOpen && <SettingsModal onClose={() => setSettingsModalOpen(false)} />}
    </div>
  );
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const { logs, reloadPlayer, toggleDebugPlayer, debugPlayerVisible } = usePlayer();
  const [testStatus, setTestStatus] = useState<'idle' | 'playing' | 'success' | 'error'>('idle');

  const playTestSound = () => {
    setTestStatus('playing');
    try {
      // Simple sine wave beep using Web Audio API for zero-dependency testing
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) {
        setTestStatus('error');
        alert('Web Audio API not supported');
        return;
      }
      
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.frequency.value = 440; // A4
      gain.gain.value = 0.1;
      
      osc.start();
      setTimeout(() => {
        osc.stop();
        ctx.close();
        setTestStatus('success');
      }, 500);
    } catch (e) {
      console.error(e);
      setTestStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#1e1e1e] p-6 rounded-xl w-[500px] shadow-2xl border border-white/10 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Settings className="text-gray-400" /> Settings & Debug
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        
        <div className="space-y-6 overflow-y-auto pr-2">
          {/* Audio Test Section */}
          <div className="bg-[#121212] p-4 rounded-lg border border-white/5">
            <h3 className="text-white font-bold mb-2 flex items-center gap-2">
              <Volume2 size={18} /> Audio Output Test
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Click the button below. If you hear a "beep", your browser audio is working. 
              If not, check your system volume or browser permissions.
            </p>
            <div className="flex gap-2 flex-wrap">
              <button 
                onClick={playTestSound}
                className={cn(
                  "px-4 py-2 rounded-full font-bold text-sm transition flex items-center gap-2",
                  testStatus === 'playing' ? "bg-yellow-500 text-black" : 
                  testStatus === 'success' ? "bg-green-500 text-black" : 
                  testStatus === 'error' ? "bg-red-500 text-white" : "bg-white text-black hover:bg-gray-200"
                )}
              >
                {testStatus === 'playing' ? 'Playing...' : 
                 testStatus === 'success' ? 'Success! Did you hear it?' : 
                 testStatus === 'error' ? 'Error Playing Sound' : 'Test Sound (Beep)'}
              </button>
              
              <button 
                onClick={reloadPlayer}
                className="px-4 py-2 rounded-full font-bold text-sm bg-red-500/10 text-red-500 hover:bg-red-500/20 transition border border-red-500/20"
              >
                Reload Player
              </button>

              <button 
                onClick={toggleDebugPlayer}
                className={cn(
                  "px-4 py-2 rounded-full font-bold text-sm transition border",
                  debugPlayerVisible 
                    ? "bg-blue-500 text-white border-blue-500" 
                    : "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20"
                )}
              >
                {debugPlayerVisible ? 'Hide Debug Player' : 'Nothing Working?'}
              </button>
            </div>
          </div>

          {/* Debug Logs Section */}
          <div className="bg-[#121212] p-4 rounded-lg border border-white/5 flex-1">
             <h3 className="text-white font-bold mb-2 flex items-center gap-2">
              <Bug size={18} /> Player Logs
            </h3>
            <div className="bg-black p-2 rounded h-48 overflow-y-auto font-mono text-xs text-green-400 border border-white/10">
              {logs.length === 0 ? (
                <span className="text-gray-600 italic">No logs yet...</span>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="mb-1 border-b border-white/5 pb-1 last:border-0">
                    {log}
                  </div>
                ))
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Share these logs if you are reporting a bug.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function JamModal({ onClose }: { onClose: () => void }) {
  const { sessionId, createSession, joinSession, leaveSession } = usePlayer();
  const [joinId, setJoinId] = useState('');
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    if (sessionId) {
      navigator.clipboard.writeText(sessionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#1e1e1e] p-6 rounded-xl w-96 shadow-2xl border border-white/10 transform transition-all scale-100" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users className="text-green-500" /> Jam Session
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        
        {sessionId ? (
          <div className="space-y-6">
            <div className="bg-[#121212] p-6 rounded-lg text-center border border-white/5 relative group">
              <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">Session Code</p>
              <div 
                onClick={copyToClipboard}
                className="text-4xl font-mono font-bold text-green-500 tracking-widest cursor-pointer hover:scale-105 transition-transform flex items-center justify-center gap-2"
              >
                {sessionId}
                {copied ? <Check size={24} /> : <Copy size={24} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
              </div>
              <p className="text-xs text-gray-500 mt-2">{copied ? 'Copied to clipboard!' : 'Click code to copy'}</p>
            </div>
            
            <p className="text-sm text-gray-300 text-center leading-relaxed">
              Share this code with friends. When you play music, it plays for everyone.
            </p>

            <button 
              onClick={() => { leaveSession(); onClose(); }}
              className="w-full py-3 rounded-full font-bold bg-transparent border border-red-500/50 text-red-500 hover:bg-red-500/10 transition"
            >
              End Session
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <button 
              onClick={createSession}
              className="w-full py-4 rounded-full font-bold bg-green-500 text-black hover:scale-105 hover:bg-green-400 transition shadow-lg shadow-green-500/20"
            >
              Start a Jam
            </button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-[#1e1e1e] text-gray-400">OR JOIN ONE</span>
              </div>
            </div>

            <div className="space-y-3">
              <input 
                type="text" 
                placeholder="Enter 6-digit code" 
                className="w-full bg-[#121212] border border-gray-700 focus:border-green-500 rounded-md px-4 py-3 text-white outline-none transition text-center font-mono tracking-widest text-lg"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                maxLength={6}
              />
              <button 
                onClick={() => joinSession(joinId)}
                disabled={joinId.length < 6}
                className="w-full py-3 rounded-full font-bold text-sm bg-white/10 text-white hover:bg-white/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Join Jam
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
