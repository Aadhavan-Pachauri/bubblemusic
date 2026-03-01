import modal
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import asyncio
import json
import uuid
import time
import logging
from typing import Dict, Set, Optional, List, Any

# --- Configuration ---
image = (
    modal.Image.debian_slim()
    .pip_install("fastapi", "uvicorn", "yt-dlp", "uuid", "requests")
)

app = modal.App("jamify-python-server")
web_app = FastAPI()

# Enable CORS
web_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Types & State ---
class Song:
    def __init__(self, id: str, title: str, artist: str, cover: str, url: str, duration: int):
        self.id = id
        self.title = title
        self.artist = artist
        self.cover = cover
        self.url = url
        self.duration = duration

    def to_dict(self):
        return self.__dict__

class JamSession:
    def __init__(self, id: str, host_id: str):
        self.id = id
        self.host_id = host_id
        self.current_song: Optional[Dict] = None
        self.is_playing = False
        self.current_time = 0.0
        self.last_update = time.time()
        self.participants: Set[WebSocket] = set()

# Global State (In-Memory)
# Note: In a serverless environment like Modal, this state persists
# as long as the container is running. If the container restarts, state is lost.
sessions: Dict[str, JamSession] = {}

# --- Helper Functions ---
async def broadcast_to_session(session: JamSession, message: dict):
    """Sends a message to all connected participants in a session."""
    data = json.dumps(message)
    # Iterate over a copy to avoid modification during iteration issues
    for client in list(session.participants):
        try:
            await client.send_text(data)
        except Exception as e:
            print(f"Error broadcasting to client: {e}")
            session.participants.discard(client)

# --- WebSocket Routes ---
@web_app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    current_session_id: Optional[str] = None
    
    try:
        while True:
            raw_message = await websocket.receive_text()
            try:
                data = json.loads(raw_message)
                msg_type = data.get("type")

                if msg_type == "CREATE_SESSION":
                    session_id = str(int(100000 + time.time() % 900000)) # Simple 6-digit-ish ID
                    new_session = JamSession(id=session_id, host_id=str(uuid.uuid4()))
                    new_session.participants.add(websocket)
                    sessions[session_id] = new_session
                    current_session_id = session_id
                    
                    await websocket.send_text(json.dumps({
                        "type": "SESSION_CREATED",
                        "sessionId": session_id,
                        "participantCount": 1
                    }))

                elif msg_type == "JOIN_SESSION":
                    session_id = data.get("sessionId")
                    session = sessions.get(session_id)
                    
                    if session:
                        session.participants.add(websocket)
                        current_session_id = session_id
                        
                        # Calculate synced time
                        synced_time = session.current_time
                        if session.is_playing:
                            synced_time += (time.time() - session.last_update)

                        # Notify user
                        await websocket.send_text(json.dumps({
                            "type": "SESSION_JOINED",
                            "sessionId": session_id,
                            "currentSong": session.current_song,
                            "isPlaying": session.is_playing,
                            "currentTime": synced_time,
                            "participantCount": len(session.participants)
                        }))

                        # Notify others
                        await broadcast_to_session(session, {
                            "type": "PARTICIPANT_UPDATE",
                            "count": len(session.participants)
                        })
                    else:
                        await websocket.send_text(json.dumps({
                            "type": "ERROR",
                            "message": "Session not found"
                        }))

                elif msg_type == "UPDATE_STATE":
                    if current_session_id:
                        session = sessions.get(current_session_id)
                        if session:
                            payload = data.get("payload", {})
                            
                            if "currentSong" in payload:
                                session.current_song = payload["currentSong"]
                            if "isPlaying" in payload:
                                session.is_playing = payload["isPlaying"]
                            if "currentTime" in payload:
                                session.current_time = payload["currentTime"]
                            
                            session.last_update = time.time()

                            # Broadcast to others
                            msg = json.dumps({
                                "type": "STATE_UPDATE",
                                "payload": payload
                            })
                            for client in list(session.participants):
                                if client != websocket:
                                    try:
                                        await client.send_text(msg)
                                    except:
                                        pass

            except json.JSONDecodeError:
                print("Invalid JSON received")
                
    except WebSocketDisconnect:
        if current_session_id:
            session = sessions.get(current_session_id)
            if session:
                session.participants.discard(websocket)
                if len(session.participants) == 0:
                    del sessions[current_session_id]
                else:
                    await broadcast_to_session(session, {
                        "type": "PARTICIPANT_UPDATE",
                        "count": len(session.participants)
                    })

# --- HTTP Routes ---

@web_app.get("/api/health")
def health_check():
    return {"status": "ok", "backend": "python-fastapi"}

@web_app.get("/api/search")
def search_songs(q: str):
    if not q:
        raise HTTPException(status_code=400, detail="Query required")
    
    try:
        import yt_dlp
        
        ydl_opts = {
            'quiet': True,
            'default_search': 'ytsearch10',
            'skip_download': True,
            'extract_flat': True, # Faster, just gets metadata
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(q, download=False)
            
            songs = []
            if 'entries' in info:
                for entry in info['entries']:
                    songs.append({
                        "id": entry.get('id'),
                        "title": entry.get('title'),
                        "artist": entry.get('uploader', 'Unknown'),
                        "cover": f"https://i.ytimg.com/vi/{entry.get('id')}/hqdefault.jpg",
                        "url": entry.get('url'),
                        "duration": entry.get('duration', 0)
                    })
            
            return songs

    except Exception as e:
        print(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@web_app.get("/api/stream/{video_id}")
def stream_audio(video_id: str):
    if not video_id:
        raise HTTPException(status_code=400, detail="Video ID required")
        
    try:
        import yt_dlp
        import requests
        
        url = f"https://www.youtube.com/watch?v={video_id}"
        
        ydl_opts = {
            'format': 'bestaudio/best',
            'quiet': True,
            'noplaylist': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            audio_url = info.get('url')
            
            if not audio_url:
                raise HTTPException(status_code=404, detail="No audio format found")
                
            # Stream the data from the YouTube URL to the client
            def iterfile():
                with requests.get(audio_url, stream=True) as r:
                    for chunk in r.iter_content(chunk_size=8192):
                        yield chunk
                        
            return StreamingResponse(iterfile(), media_type="audio/mpeg")

    except Exception as e:
        print(f"Stream error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Modal Entrypoint ---
@app.function(image=image, keep_warm=1)
@modal.asgi_app()
def fastapi_app():
    return web_app
