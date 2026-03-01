import React, { useState } from 'react';
import { Settings, Volume2, Bug } from 'lucide-react';
import { usePlayer } from '@/context/PlayerContext';
import { cn } from '@/lib/utils';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { logs, reloadPlayer, toggleDebugPlayer, debugPlayerVisible, calibrateLatency, latencyMs } = usePlayer();
  const [testStatus, setTestStatus] = useState<'idle' | 'playing' | 'success' | 'error'>('idle');
  const [calibrating, setCalibrating] = useState(false);

  const handleCalibrate = async () => {
    setCalibrating(true);
    await calibrateLatency();
    setCalibrating(false);
  };

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
              <Volume2 size={18} /> Audio & Sync Calibration
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              If your audio is out of sync during a Jam Session, run the calibration tool. It will play a short beep and use your microphone to measure the exact audio delay on your device.
            </p>
            <div className="flex gap-2 flex-wrap items-center">
              <button 
                onClick={handleCalibrate}
                disabled={calibrating}
                className={cn(
                  "px-4 py-2 rounded-full font-bold text-sm transition flex items-center gap-2",
                  calibrating ? "bg-yellow-500 text-black opacity-70 cursor-not-allowed" : "bg-green-500 text-black hover:bg-green-400"
                )}
              >
                {calibrating ? 'Calibrating...' : 'Calibrate Sync Delay'}
              </button>
              
              {latencyMs > 0 && (
                <span className="text-xs text-green-400 font-mono bg-green-500/10 px-2 py-1 rounded border border-green-500/20">
                  Delay: {latencyMs}ms
                </span>
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-white/5 flex gap-2 flex-wrap">
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
