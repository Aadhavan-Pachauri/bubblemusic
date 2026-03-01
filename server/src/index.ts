import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import yts from 'yt-search';
import { v4 as uuidv4 } from 'uuid';
import { createServer as createViteServer } from 'vite';
import path from 'path';

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });
const PORT = 3000;

app.use(cors());
app.use(express.json());

// --- Types ---
interface Song {
  id: string;
  title: string;
  artist: string;
  cover: string;
  url: string;
  duration: number;
}

interface JamSession {
  id: string;
  hostId: string;
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  lastUpdate: number;
  participants: Set<WebSocket>;
}

// --- State ---
const sessions = new Map<string, JamSession>();

// --- WebSocket Logic ---
wss.on('connection', (ws) => {
  let currentSessionId: string | null = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case 'CREATE_SESSION': {
          const sessionId = Math.floor(100000 + Math.random() * 900000).toString();
          sessions.set(sessionId, {
            id: sessionId,
            hostId: uuidv4(),
            currentSong: null,
            isPlaying: false,
            currentTime: 0,
            lastUpdate: Date.now(),
            participants: new Set([ws]),
          });
          currentSessionId = sessionId;
          ws.send(JSON.stringify({ 
            type: 'SESSION_CREATED', 
            sessionId,
            participantCount: 1 
          }));
          break;
        }

        case 'JOIN_SESSION': {
          const { sessionId } = data;
          const session = sessions.get(sessionId);
          if (session) {
            session.participants.add(ws);
            currentSessionId = sessionId;
            
            // Notify user of success
            ws.send(JSON.stringify({ 
              type: 'SESSION_JOINED', 
              sessionId,
              currentSong: session.currentSong,
              isPlaying: session.isPlaying,
              currentTime: session.currentTime + (session.isPlaying ? (Date.now() - session.lastUpdate) / 1000 : 0),
              participantCount: session.participants.size
            }));

            // Notify others
            broadcastToSession(session, {
              type: 'PARTICIPANT_UPDATE',
              count: session.participants.size
            });
          } else {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Session not found' }));
          }
          break;
        }

        case 'UPDATE_STATE': {
          if (!currentSessionId) return;
          const session = sessions.get(currentSessionId);
          if (!session) return;

          if (data.payload.currentSong !== undefined) session.currentSong = data.payload.currentSong;
          if (data.payload.isPlaying !== undefined) session.isPlaying = data.payload.isPlaying;
          if (data.payload.currentTime !== undefined) session.currentTime = data.payload.currentTime;
          session.lastUpdate = Date.now();

          // Broadcast to ALL participants (including sender) to ensure perfect sync state
          // or just others? Usually others for latency, but let's do others for now.
          session.participants.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'STATE_UPDATE',
                payload: data.payload
              }));
            }
          });
          break;
        }
      }
    } catch (e) {
      console.error('WS Error:', e);
    }
  });

  ws.on('close', () => {
    if (currentSessionId) {
      const session = sessions.get(currentSessionId);
      if (session) {
        session.participants.delete(ws);
        if (session.participants.size === 0) {
          sessions.delete(currentSessionId);
        } else {
          broadcastToSession(session, {
            type: 'PARTICIPANT_UPDATE',
            count: session.participants.size
          });
        }
      }
    }
  });
});

function broadcastToSession(session: JamSession, message: any) {
  const data = JSON.stringify(message);
  session.participants.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// --- API Routes ---
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ error: 'Query required' });
    }

    // Revert to yt-search as it is reliable for metadata
    const r = await yts(query);
    const songs: Song[] = r.videos.slice(0, 10).map(v => ({
      id: v.videoId,
      title: v.title,
      artist: v.author.name,
      cover: v.thumbnail,
      url: v.url,
      duration: v.seconds
    }));

    res.json(songs);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

import ytdl from '@distube/ytdl-core';

// ... existing imports ...

// ... existing code ...

app.get('/api/stream/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    if (!videoId) {
      return res.status(400).json({ error: 'Video ID required' });
    }

    console.log(`Fetching stream for ${videoId} using ytdl-core...`);
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    // Get video info first to find the best audio format
    const info = await ytdl.getInfo(url);
    const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });

    if (!format) {
      return res.status(404).json({ error: 'No audio format found' });
    }

    console.log(`Found format: ${format.mimeType}`);

    // Set appropriate headers for audio streaming
    res.setHeader('Content-Type', format.mimeType || 'audio/mpeg');
    res.setHeader('Content-Disposition', `inline; filename="${videoId}.mp3"`);

    // Pipe the audio stream directly to the response
    ytdl(url, { format: format }).pipe(res);

  } catch (error) {
    console.error('Stream proxy error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to fetch stream info' });
    }
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// --- Vite Integration (for Dev) ---
// In a real standalone server deployment, you wouldn't have this. 
// But for this specific environment, we need to serve the frontend too.
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
      root: process.cwd(), // Use process.cwd() to ensure we look at the project root
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), 'dist')));
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
