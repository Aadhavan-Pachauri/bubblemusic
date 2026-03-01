import React, { useEffect, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Repeat, Shuffle, Mic2, ListMusic, MonitorSpeaker, Volume2, Maximize2, Heart } from 'lucide-react';
import { usePlayer } from '@/context/PlayerContext';
import { cn } from '@/lib/utils';

export function Player() {
  const { currentSong, isPlaying, togglePlay, volume, setVolume, currentTime, seek, sessionId, duration } = usePlayer();
  const [localTime, setLocalTime] = useState(currentTime);
  const [isDragging, setIsDragging] = useState(false);

  // Sync local slider with context time unless dragging
  useEffect(() => {
    if (!isDragging) {
      setLocalTime(currentTime);
    }
  }, [currentTime, isDragging]);

  // Reset local time when song changes
  useEffect(() => {
    setLocalTime(0);
  }, [currentSong?.id]);

  // REMOVED: Simulated progress interval
  // The global player now updates currentTime frequently enough via context
  // This prevents the UI from "running ahead" of the actual player state

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalTime(parseFloat(e.target.value));
  };

  const handleSeekCommit = () => {
    setIsDragging(false);
    seek(localTime);
  };

  if (!currentSong) return null;

  return (
    <div className="h-24 md:h-24 bg-[#181818] border-t border-[#282828] px-4 flex items-center justify-between z-50 text-[#b3b3b3] relative">
      
      {/* Left: Song Info */}
      <div className="flex items-center gap-3 md:gap-4 w-[60%] md:w-[30%] overflow-hidden">
        <img src={currentSong.cover} alt="Cover" className="h-12 w-12 md:h-14 md:w-14 rounded-md shadow-lg shrink-0" />
        <div className="flex flex-col justify-center overflow-hidden">
          <span className="text-white text-sm font-medium hover:underline cursor-pointer truncate">{currentSong.title}</span>
          <span className="text-xs hover:underline cursor-pointer hover:text-white transition truncate">{currentSong.artist}</span>
        </div>
        <div className="hidden md:block">
          <HeartButton />
        </div>
      </div>

      {/* Center: Controls */}
      <div className="flex flex-col items-center gap-2 w-[40%] md:w-[40%] max-w-2xl">
        <div className="flex items-center gap-4 md:gap-6">
          <Shuffle size={16} className="hidden md:block hover:text-white cursor-pointer transition" />
          <SkipBack size={20} className="hover:text-white cursor-pointer transition fill-current" />
          
          <button 
            onClick={togglePlay}
            className="w-8 h-8 md:w-8 md:h-8 bg-white rounded-full flex items-center justify-center hover:scale-105 transition text-black"
          >
            {isPlaying ? <Pause size={20} fill="black" /> : <Play size={20} fill="black" className="ml-1" />}
          </button>
          
          <SkipForward size={20} className="hover:text-white cursor-pointer transition fill-current" />
          <Repeat size={16} className="hidden md:block hover:text-white cursor-pointer transition" />
        </div>

        <div className="w-full flex items-center gap-2 text-xs font-mono hidden md:flex">
          <span>{formatTime(localTime)}</span>
          <div className="flex-1 group relative h-1 bg-[#4d4d4d] rounded-full cursor-pointer">
            <input 
              type="range" 
              min={0} 
              max={duration || 100} 
              value={localTime}
              onChange={handleSeekChange}
              onMouseDown={() => setIsDragging(true)}
              onMouseUp={handleSeekCommit}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div 
              className="h-full bg-white rounded-full group-hover:bg-green-500 transition-colors"
              style={{ width: `${duration ? (localTime / duration) * 100 : 0}%` }}
            />
            <div 
              className="absolute h-3 w-3 bg-white rounded-full top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
              style={{ left: `${duration ? (localTime / duration) * 100 : 0}%` }}
            />
          </div>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Mobile Progress Bar (Absolute Top) */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-[#282828] md:hidden">
         <div 
            className="h-full bg-white"
            style={{ width: `${duration ? (localTime / duration) * 100 : 0}%` }}
          />
      </div>

      {/* Right: Volume & Extras */}
      <div className="hidden md:flex items-center justify-end gap-3 w-[30%]">
        <Mic2 size={16} className="hover:text-white cursor-pointer" />
        <ListMusic size={16} className="hover:text-white cursor-pointer" />
        <MonitorSpeaker size={16} className={cn("hover:text-white cursor-pointer transition", sessionId && "text-green-500")} />
        <div className="flex items-center gap-2 w-24 group">
          <Volume2 size={16} className="hover:text-white cursor-pointer" />
          <div className="h-1 flex-1 bg-[#4d4d4d] rounded-full relative">
            <div 
              className="h-full bg-white group-hover:bg-green-500 rounded-full"
              style={{ width: `${volume * 100}%` }}
            />
          </div>
        </div>
        <Maximize2 size={16} className="hover:text-white cursor-pointer" />
      </div>
      
      {/* Mobile Heart Button */}
      <div className="md:hidden">
         <HeartButton />
      </div>
    </div>
  );
}

function HeartButton() {
  const [liked, setLiked] = useState(false);
  return (
    <button onClick={() => setLiked(!liked)} className={cn("transition", liked ? "text-green-500" : "hover:text-white")}>
      <Heart size={16} fill={liked ? "currentColor" : "none"} />
    </button>
  );
}
