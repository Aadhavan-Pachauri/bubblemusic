import React, { useState, useEffect } from 'react';
import { usePlayer } from '@/context/PlayerContext';
import { Song } from '@/lib/data';
import { Play, Clock3, Search, Loader2 } from 'lucide-react';

export function MainView() {
  const { playSong, currentSong, isPlaying, searchSongs } = usePlayer();
  const [searchTerm, setSearchTerm] = useState('');
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [debouncedTerm, setDebouncedTerm] = useState(searchTerm);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Perform search
  useEffect(() => {
    if (debouncedTerm.trim()) {
      setLoading(true);
      searchSongs(debouncedTerm)
        .then(setSongs)
        .finally(() => setLoading(false));
    } else {
      // Default / Initial state could be empty or some trending
      // For now, let's leave it empty or show a "Search for something" state
    }
  }, [debouncedTerm]);

  // Greeting based on time
  const hour = new Date().getHours();
  let greeting = 'Good evening';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 18) greeting = 'Good afternoon';

  return (
    <div className="flex-1 bg-[#121212] rounded-lg overflow-y-auto relative no-scrollbar">
      {/* Header Gradient */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-green-900/50 to-[#121212] pointer-events-none" />

      <div className="relative z-10 p-6">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-8 sticky top-0 z-50 pt-2">
          <div className="flex items-center gap-4">
             {/* Navigation Arrows */}
          </div>
          <div className="relative w-full max-w-md">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
             <input 
               type="text" 
               placeholder="What do you want to play?" 
               className="w-full bg-[#242424] rounded-full py-3 pl-10 pr-4 text-sm text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-white/20 transition shadow-lg"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               autoFocus
             />
          </div>
        </div>

        {!debouncedTerm && (
          <>
            <h1 className="text-3xl font-bold text-white mb-6">{greeting}</h1>
            <div className="text-gray-400 text-center mt-20">
              <Search size={48} className="mx-auto mb-4 opacity-50" />
              <p>Search for songs, artists, or podcasts</p>
            </div>
          </>
        )}

        {loading && (
          <div className="flex justify-center mt-20">
            <Loader2 className="animate-spin text-green-500" size={40} />
          </div>
        )}

        {songs.length > 0 && !loading && (
          <div className="flex flex-col">
            <h2 className="text-2xl font-bold text-white mb-4">Top Results</h2>
            
            {/* Header Row */}
            <div className="grid grid-cols-[16px_1fr_auto] md:grid-cols-[16px_4fr_minmax(120px,1fr)] gap-4 px-4 py-2 text-sm text-[#b3b3b3] border-b border-[#282828] mb-2 sticky top-16 bg-[#121212] z-40">
              <span>#</span>
              <span>Title</span>
              <span className="flex justify-end"><Clock3 size={16} /></span>
            </div>

            {/* Rows */}
            {songs.map((song, index) => {
              const isCurrent = currentSong?.id === song.id;
              return (
                <div 
                  key={song.id}
                  onClick={() => playSong(song)}
                  className="grid grid-cols-[16px_1fr_auto] md:grid-cols-[16px_4fr_minmax(120px,1fr)] gap-4 px-4 py-3 text-sm text-[#b3b3b3] hover:bg-[#2a2a2a] rounded-md cursor-pointer group items-center transition-colors"
                >
                  <div className="flex items-center justify-center w-4">
                    {isCurrent && isPlaying ? (
                      <img src="https://open.spotifycdn.com/cdn/images/equaliser-animated-green.f93a2ef4.gif" className="h-3 w-3" alt="playing" />
                    ) : (
                      <>
                        <span className="group-hover:hidden">{index + 1}</span>
                        <Play size={12} fill="white" className="text-white hidden group-hover:block" />
                      </>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <img src={song.cover} alt={song.title} className="h-10 w-10 rounded object-cover" />
                    <div className="flex flex-col">
                      <span className={`font-medium text-base truncate ${isCurrent ? 'text-green-500' : 'text-white'}`}>{song.title}</span>
                      <span className="group-hover:text-white transition truncate text-xs">{song.artist}</span>
                    </div>
                  </div>

                  <div className="flex justify-end font-mono">
                    {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
