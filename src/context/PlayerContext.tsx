import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Song } from '@/lib/data';

interface PlayerContextType {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  volume: number;
  sessionId: string | null;
  participantCount: number;
  playSong: (song: Song) => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  updateCurrentTime: (time: number) => void;
  setVolume: (vol: number) => void;
  createSession: () => void;
  joinSession: (id: string) => void;
  leaveSession: () => void;
  isHost: boolean;
  searchSongs: (query: string) => Promise<Song[]>;
  reloadPlayer: () => void;
  playerKey: number;
  debugPlayerVisible: boolean;
  toggleDebugPlayer: () => void;
  isJamModalOpen: boolean;
  setJamModalOpen: (open: boolean) => void;
  isSettingsModalOpen: boolean;
  setSettingsModalOpen: (open: boolean) => void;
  calibrateLatency: () => Promise<number>;
  latencyMs: number;
  duration: number;
  setDuration: (dur: number) => void;
  isCalibrating: boolean;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

// --- CONFIGURATION ---
// Change this to your PythonAnywhere URL when deployed!
const API_BASE = 'https://AadhavanPachauri.pythonanywhere.com'; 

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1.0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null); // Track our user ID
  const [isHost, setIsHost] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [playerKey, setPlayerKey] = useState(0);
  const [debugPlayerVisible, setDebugPlayerVisible] = useState(false);
  const [isJamModalOpen, setJamModalOpen] = useState(false);
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
  const [latencyMs, setLatencyMs] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isCalibrating, setIsCalibrating] = useState(false);
  
  // Version tracking to avoid jitter
  const lastVersion = useRef(0);
  const lastSequence = useRef(0);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  
  // Tick System Refs
  const baseTime = useRef(0);
  const baseTimeReceivedAt = useRef(0);
  const tickInterval = useRef<NodeJS.Timeout | null>(null);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 49)]);
  }, []);

  const updateCurrentTime = useCallback((time: number) => {
    // Only update the base anchor time if we are NOT in a session.
    // If we are in a session, the server is the absolute source of truth
    // and the Tick System will drive the currentTime.
    if (!sessionId) {
      setCurrentTime(time);
      baseTime.current = time;
      baseTimeReceivedAt.current = Date.now();
    }
  }, [sessionId]);

  const reloadPlayer = useCallback(() => {
    addLog("Reloading player...");
    setPlayerKey(prev => prev + 1);
  }, [addLog]);

  const toggleDebugPlayer = useCallback(() => {
    setDebugPlayerVisible(prev => !prev);
  }, []);
  
  // --- TICK SYSTEM (20Hz / 50ms) ---
  useEffect(() => {
    // Only run tick if we have a session and are playing
    if (sessionId && isPlaying) {
      tickInterval.current = setInterval(() => {
        const elapsed = (Date.now() - baseTimeReceivedAt.current) / 1000;
        const predictedTime = baseTime.current + elapsed;
        setCurrentTime(predictedTime);
      }, 50); // 20 ticks per second
    } else {
      if (tickInterval.current) clearInterval(tickInterval.current);
    }

    return () => {
      if (tickInterval.current) clearInterval(tickInterval.current);
    };
  }, [sessionId, isPlaying]);

  // --- POLLING LOGIC ---
  const pollState = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      const reqStart = Date.now();
      const res = await fetch(`${API_BASE}/api/jam/state/${sessionId}?userId=${userId || ''}`);
      const reqEnd = Date.now();
      const rtt = (reqEnd - reqStart) / 1000; // Round trip time in seconds
      
      if (!res.ok) {
        if (res.status === 404) {
           addLog("Session ended or not found.");
           leaveSession();
        }
        return;
      }
      
      const data = await res.json();
      
      // Dynamic Network Latency Compensation (NTP style)
      if (data.isPlaying && data.currentTime !== undefined) {
          data.currentTime += (rtt / 2); // Add half the round-trip time
      }
      
      // Only update if version changed or we are just starting
      if (data.version > lastVersion.current) {
        lastVersion.current = data.version;
        
        // Force update if sequence changed (Play/Pause/Seek happened)
        const sequenceChanged = (data.sequence || 0) > lastSequence.current;
        
        if (sequenceChanged) {
            lastSequence.current = data.sequence || 0;
            // Immediate Sync
            if (data.currentSong?.id !== currentSong?.id) setCurrentSong(data.currentSong);
            setIsPlaying(data.isPlaying);
            
            // Update Anchor
            baseTime.current = data.currentTime;
            baseTimeReceivedAt.current = Date.now();
            setCurrentTime(data.currentTime);
            
            setParticipantCount(data.participantCount);
            return; 
        }

        // Regular Sync (Drift Correction)
        if (data.currentSong?.id !== currentSong?.id) {
           setCurrentSong(data.currentSong);
        }
        
        if (data.isPlaying !== isPlaying) {
           setIsPlaying(data.isPlaying);
           // If we just started playing, reset anchor
           if (data.isPlaying) {
             baseTime.current = data.currentTime;
             baseTimeReceivedAt.current = Date.now();
           }
        }
        
        // Check for drift > 0.5s (Tightened from 1.5s)
        const elapsed = (Date.now() - baseTimeReceivedAt.current) / 1000;
        const localPredicted = baseTime.current + (isPlaying ? elapsed : 0);
        const drift = Math.abs(localPredicted - data.currentTime);

        if (drift > 0.5) {
           // Hard correct
           baseTime.current = data.currentTime;
           baseTimeReceivedAt.current = Date.now();
           setCurrentTime(data.currentTime);
        }
        
        setParticipantCount(data.participantCount);
      }
    } catch (e) {
      console.error("Polling error", e);
    }
  }, [sessionId, currentSong, isPlaying, currentTime]);

  // Start polling when session is active
  useEffect(() => {
    if (sessionId) {
      addLog(`Starting polling for session ${sessionId}`);
      pollingInterval.current = setInterval(pollState, 500); // Poll every 500ms (Faster!)
    } else {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
    }
    
    return () => {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
    };
  }, [sessionId, pollState]);


  // --- ACTIONS ---

  const createSession = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/jam/create`, { method: 'POST' });
      const data = await res.json();
      setSessionId(data.sessionId);
      setUserId(data.userId);
      setIsHost(true);
      setParticipantCount(1);
      addLog(`Session created: ${data.sessionId}`);
    } catch (e) {
      addLog("Failed to create session");
      console.error(e);
    }
  };

  const joinSession = async (id: string) => {
    try {
      setIsCalibrating(true);
      addLog(`Joining session: ${id}...`);
      
      // Measure initial connection latency
      const pingStart = Date.now();
      const res = await fetch(`${API_BASE}/api/jam/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: id })
      });
      const pingEnd = Date.now();
      const initialRtt = (pingEnd - pingStart) / 1000;
      
      if (!res.ok) throw new Error("Session not found");
      
      const data = await res.json();
      setSessionId(data.sessionId);
      setUserId(data.userId);
      setIsHost(false);
      
      // Sync initial state
      if (data.state) {
        if (data.state.currentSong) setCurrentSong(data.state.currentSong);
        setIsPlaying(data.state.isPlaying);
        
        // Apply initial time with RTT compensation
        const compensatedTime = data.state.currentTime + (initialRtt / 2);
        setCurrentTime(compensatedTime);
        baseTime.current = compensatedTime;
        baseTimeReceivedAt.current = Date.now();
        
        setParticipantCount(data.state.participantCount);
      }
      
      addLog(`Joined session: ${data.sessionId}. RTT: ${initialRtt.toFixed(3)}s`);
      
      // Give the player a moment to load and buffer before lifting the calibration veil
      setTimeout(() => {
        setIsCalibrating(false);
      }, 2000);
      
    } catch (e) {
      setIsCalibrating(false);
      addLog("Failed to join session");
      console.error(e);
    }
  };

  const leaveSession = () => {
    setSessionId(null);
    setUserId(null);
    setIsHost(false);
    setParticipantCount(0);
    if (pollingInterval.current) clearInterval(pollingInterval.current);
    addLog("Left session");
  };

  const sendUpdate = async (payload: any) => {
    if (!sessionId) return;
    
    // Optimistic update
    if (payload.isPlaying !== undefined) setIsPlaying(payload.isPlaying);
    if (payload.currentSong !== undefined) setCurrentSong(payload.currentSong);
    
    try {
      await fetch(`${API_BASE}/api/jam/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          payload
        })
      });
    } catch (e) {
      console.error("Failed to send update", e);
    }
  };

  const playSong = useCallback((song: Song) => {
    setCurrentSong(song);
    setIsPlaying(true);
    setCurrentTime(0);
    
    if (sessionId) {
      sendUpdate({ currentSong: song, isPlaying: true, currentTime: 0 });
    }
  }, [sessionId]);

  const togglePlay = useCallback(() => {
    setIsPlaying(prev => {
      const newState = !prev;
      if (sessionId) {
        sendUpdate({ isPlaying: newState, currentTime });
      }
      return newState;
    });
  }, [sessionId, currentTime]);

  const seek = useCallback((time: number) => {
    setCurrentTime(time);
    if (sessionId) {
      sendUpdate({ currentTime: time });
    }
  }, [sessionId]);

  const searchSongs = async (query: string): Promise<Song[]> => {
    // ALWAYS use the server's search capabilities as requested
    try {
      addLog(`Searching server for: ${query}`);
      const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Search failed');
      return await res.json();
    } catch (e) {
      console.error("Search error:", e);
      addLog(`Search failed.`);
      return [];
    }
  };

  const calibrateLatency = async (): Promise<number> => {
    if (!sessionId || !userId) {
      addLog("Cannot calibrate: Not in a session.");
      return 0;
    }

    try {
      addLog("Starting audio calibration...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      const microphone = audioCtx.createMediaStreamSource(stream);
      microphone.connect(analyser);
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(3000, audioCtx.currentTime); // High pitch beep
      osc.connect(audioCtx.destination);
      
      const startTime = Date.now();
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1); // Play for 100ms

      return new Promise<number>((resolve) => {
        const checkAudio = () => {
          analyser.getByteFrequencyData(dataArray);
          // Check higher frequencies for the beep
          let sum = 0;
          for(let i = 10; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          if (sum > 500) { // Threshold reached
            const measuredLatency = Date.now() - startTime;
            stream.getTracks().forEach(t => t.stop());
            audioCtx.close();
            
            // Save to server
            fetch(`${API_BASE}/api/jam/calibrate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId, userId, latencyMs: measuredLatency })
            }).then(() => {
              setLatencyMs(measuredLatency);
              addLog(`Calibration complete: ${measuredLatency}ms`);
              resolve(measuredLatency);
            }).catch(e => {
              console.error(e);
              resolve(measuredLatency);
            });
            
          } else if (Date.now() - startTime > 2000) {
            // Timeout after 2 seconds
            stream.getTracks().forEach(t => t.stop());
            audioCtx.close();
            addLog("Calibration failed: Could not hear beep.");
            resolve(0);
          } else {
            requestAnimationFrame(checkAudio);
          }
        };
        checkAudio();
      });
    } catch (e) {
      console.error("Calibration error", e);
      addLog("Calibration failed: Mic access denied.");
      return 0;
    }
  };

  return (
    <PlayerContext.Provider value={{
      currentSong,
      isPlaying,
      currentTime,
      volume,
      sessionId,
      participantCount,
      playSong,
      togglePlay,
      seek,
      updateCurrentTime,
      setVolume,
      createSession,
      joinSession,
      leaveSession,
      isHost,
      searchSongs,
      logs,
      addLog,
      reloadPlayer,
      playerKey,
      debugPlayerVisible,
      toggleDebugPlayer,
      isJamModalOpen,
      setJamModalOpen,
      isSettingsModalOpen,
      setSettingsModalOpen,
      calibrateLatency,
      latencyMs,
      duration,
      setDuration,
      isCalibrating
    }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}
