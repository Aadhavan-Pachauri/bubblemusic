import React, { useEffect, useRef, useState } from 'react';
import YouTube, { YouTubeProps } from 'react-youtube';
import getYouTubeID from 'get-youtube-id';
import { usePlayer } from '@/context/PlayerContext';
import { Maximize2, Minimize2, Play } from 'lucide-react';

export function GlobalPlayer() {
  const { currentSong, isPlaying, volume, currentTime, togglePlay, addLog, playerKey, updateCurrentTime, setDuration, isCalibrating } = usePlayer();
  const playerRef = useRef<any>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [played, setPlayed] = useState(0);
  const lastSeekTime = useRef(0);

  // Extract Video ID
  const videoId = currentSong ? (getYouTubeID(currentSong.url) || currentSong.id) : null;

  // Safe executor for YouTube API calls
  const safePlayerCall = (fn: () => void, errorMsg: string) => {
    if (playerRef.current && ready) {
      try {
        // Check if the iframe still exists and has a src before calling methods
        const iframe = playerRef.current.getIframe();
        if (iframe && iframe.src) {
           fn();
        }
      } catch (e) {
        console.warn(`${errorMsg}:`, e);
      }
    }
  };

  // Sync Play/Pause
  useEffect(() => {
    safePlayerCall(() => {
      if (typeof playerRef.current.playVideo === 'function') {
        if (isPlaying) {
          playerRef.current.playVideo();
        } else {
          playerRef.current.pauseVideo();
        }
      }
    }, "Error syncing play state");
  }, [isPlaying, ready]);

  // Sync Volume
  useEffect(() => {
    safePlayerCall(() => {
      if (typeof playerRef.current.setVolume === 'function') {
        playerRef.current.setVolume(volume * 100);
      }
    }, "Error syncing volume");
  }, [volume, ready]);

  // Sync Seek
  useEffect(() => {
    safePlayerCall(() => {
      if (typeof playerRef.current.seekTo === 'function') {
        const current = playerRef.current.getCurrentTime();
        // Tightened sync threshold from 2.0s to 0.3s
        if (Math.abs(current - currentTime) > 0.3) {
          // Cooldown of 1.5s to prevent seek loops while buffering
          if (Date.now() - lastSeekTime.current > 1500) {
            playerRef.current.seekTo(currentTime, true);
            lastSeekTime.current = Date.now();
          }
        }
      }
    }, "Error syncing seek");
  }, [currentTime, ready]);

  // Poll for progress
  useEffect(() => {
    let interval: any;
    if (ready && isPlaying && playerRef.current) {
      interval = setInterval(() => {
        safePlayerCall(() => {
            if (typeof playerRef.current.getCurrentTime === 'function') {
              const time = playerRef.current.getCurrentTime();
              const dur = playerRef.current.getDuration();
              setPlayed(time);
              setDuration(dur);
              updateCurrentTime(time); // Drive the UI with actual player time (only works if not in session)
            }
        }, "Polling error");
      }, 200); // Update 5 times a second for smooth-ish UI
    }
    return () => clearInterval(interval);
  }, [ready, isPlaying, updateCurrentTime]);

  useEffect(() => {
    if (currentSong) {
      playerRef.current = null; // Reset player ref to avoid stale calls
      setError(null);
      setReady(false);
      setPlayed(0);
      addLog(`Loading YouTube Native: ${currentSong.title}`);
    }
  }, [currentSong, addLog]);

  if (!videoId) return null;

  const opts: YouTubeProps['opts'] = {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 1,
      controls: 1,
      disablekb: 0,
      enablejsapi: 1,
      fs: 1,
      modestbranding: 1,
      rel: 0,
      origin: window.location.origin
    },
  };

  return (
    <div 
      className={`fixed z-40 transition-all duration-300 shadow-2xl bg-black overflow-hidden border border-white/10 group
        ${isExpanded 
          ? 'top-20 left-4 right-4 bottom-28 md:w-auto md:h-auto rounded-xl' 
          : 'bottom-32 md:bottom-24 right-2 md:right-4 w-32 md:w-80 h-20 md:h-48 rounded-lg hover:scale-105'
        }`}
    >
      {/* Header Controls */}
      <div className="absolute top-0 left-0 right-0 p-2 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <span className="text-xs text-white/80 font-medium truncate px-2 drop-shadow-md">{currentSong?.title}</span>
        <div className="flex gap-2 pointer-events-auto">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 hover:bg-white/20 rounded-full text-white backdrop-blur-sm"
          >
            {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Debug Overlay */}
      <div className="absolute top-8 left-2 right-2 z-20 pointer-events-none">
        <div className="bg-black/80 text-[10px] text-green-400 p-2 rounded border border-green-500/30 font-mono">
          <div>ID: {videoId}</div>
          <div>Status: {ready ? 'Ready' : 'Loading...'} | Playing: {isPlaying ? 'Yes' : 'No'}</div>
          <div>Time: {played.toFixed(1)} / {duration.toFixed(1)}s</div>
          {error && <div className="text-red-500 font-bold mt-1">Error: {error}</div>}
          
          <div className="pointer-events-auto mt-2 flex gap-2">
             <button 
              onClick={() => window.location.reload()}
              className="bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded text-[10px]"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>

      {/* Force Play Button */}
      {ready && !isPlaying && played === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-auto bg-black/40">
           <button 
             onClick={() => {
               if (playerRef.current) {
                 playerRef.current.playVideo();
                 // Also toggle context state
                 if (!isPlaying) togglePlay();
               }
             }}
             className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-lg transform hover:scale-105 transition"
           >
             <Play size={16} fill="currentColor" /> Click to Start
           </button>
        </div>
      )}

      {/* Calibration Overlay */}
      {isCalibrating && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-50 pointer-events-auto bg-black/80 backdrop-blur-sm">
           <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4"></div>
           <p className="text-white font-bold text-sm">Wait, calibrating sync...</p>
           <p className="text-gray-400 text-xs mt-1">Measuring network delay</p>
        </div>
      )}

      <YouTube
        key={playerKey}
        videoId={videoId}
        opts={opts}
        className="w-full h-full"
        iframeClassName="w-full h-full"
        onReady={(event) => {
          playerRef.current = event.target;
          setReady(true);
          addLog("YouTube Native Player Ready");
          event.target.setVolume(volume * 100);
          
          // Initial seek to match current time before playing
          if (currentTime > 0) {
             event.target.seekTo(currentTime, true);
          }
          
          if (isPlaying) {
             event.target.playVideo();
          }
        }}
        onStateChange={(event) => {
          // -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (video cued).
          const state = event.data;
          if (state === 1) { // Playing
             if (!isPlaying) togglePlay(); 
          }
          if (state === 2) { // Paused
             if (isPlaying) togglePlay();
          }
          if (state === 0) { // Ended
             togglePlay();
          }
        }}
        onError={(e) => {
          const errCodes: Record<number, string> = {
            2: "Invalid Parameter",
            5: "HTML5 Error",
            100: "Video Not Found",
            101: "Embedded Playback Forbidden",
            150: "Embedded Playback Forbidden"
          };
          const msg = errCodes[Number(e.data)] || `Unknown Error ${e.data}`;
          addLog(`YouTube Error: ${msg}`);
          setError(msg);
        }}
      />
    </div>
  );
}
