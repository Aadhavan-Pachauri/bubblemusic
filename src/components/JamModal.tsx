import React, { useState } from 'react';
import { Users, Copy, Check } from 'lucide-react';
import { usePlayer } from '@/context/PlayerContext';

export function JamModal({ onClose }: { onClose: () => void }) {
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
