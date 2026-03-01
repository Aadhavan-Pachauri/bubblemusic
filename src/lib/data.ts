export interface Song {
  id: string;
  title: string;
  artist: string;
  cover: string;
  url: string; // YouTube URL or MP3 URL
  duration: number;
}

// Mock Data for "Search"
export const DEMO_SONGS: Song[] = [
  {
    id: '1',
    title: 'On & On',
    artist: 'Cartoon, Daniel Levi',
    cover: 'https://i.ytimg.com/vi/K4DyBUG242c/maxresdefault.jpg',
    url: 'https://www.youtube.com/watch?v=K4DyBUG242c',
    duration: 208
  },
  {
    id: '2',
    title: 'Invincible',
    artist: 'Deaf Kev',
    cover: 'https://i.ytimg.com/vi/J2X5mJ3HDYE/maxresdefault.jpg',
    url: 'https://www.youtube.com/watch?v=J2X5mJ3HDYE',
    duration: 273
  },
  {
    id: '3',
    title: 'Mortals',
    artist: 'Warriyo, Laura Brehm',
    cover: 'https://i.ytimg.com/vi/yJg-Y5byMMw/maxresdefault.jpg',
    url: 'https://www.youtube.com/watch?v=yJg-Y5byMMw',
    duration: 230
  },
  {
    id: '4',
    title: 'My Heart',
    artist: 'Different Heaven, EH!DE',
    cover: 'https://i.ytimg.com/vi/jK2aIUmmdP4/maxresdefault.jpg',
    url: 'https://www.youtube.com/watch?v=jK2aIUmmdP4',
    duration: 267
  },
  {
    id: '5',
    title: 'Sky High',
    artist: 'Elektronomia',
    cover: 'https://i.ytimg.com/vi/TW9d8vYrVFQ/maxresdefault.jpg',
    url: 'https://www.youtube.com/watch?v=TW9d8vYrVFQ',
    duration: 238
  }
];
