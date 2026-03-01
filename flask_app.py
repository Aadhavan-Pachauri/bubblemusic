
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
import yt_dlp
import requests
import uuid
import time
import json
import sqlite3
import os
import traceback

app = Flask(__name__)
# Allow all origins
CORS(app, resources={r"/*": {"origins": "*"}})

# --- CONFIGURATION ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(BASE_DIR, 'jamify.db')
YOUTUBE_API_KEY = "AIzaSyClXzDllvcWZ-yY_fYrz0PAehpONYq4qsM" # User provided key

def init_db():
    try:
        with sqlite3.connect(DB_FILE) as conn:
            c = conn.cursor()
            c.execute('''CREATE TABLE IF NOT EXISTS sessions
                         (session_id TEXT PRIMARY KEY, data TEXT, last_active REAL)''')
            conn.commit()
    except Exception as e:
        print(f"DB Init Error: {e}")

if not os.path.exists(DB_FILE):
    init_db()

def get_session(session_id):
    try:
        with sqlite3.connect(DB_FILE) as conn:
            c = conn.cursor()
            c.execute("SELECT data FROM sessions WHERE session_id=?", (session_id,))
            row = c.fetchone()
            if row:
                return json.loads(row[0])
    except Exception as e:
        print(f"DB Read Error: {e}")
    return None

def save_session(session_id, data):
    try:
        with sqlite3.connect(DB_FILE) as conn:
            c = conn.cursor()
            c.execute("INSERT OR REPLACE INTO sessions (session_id, data, last_active) VALUES (?, ?, ?)", 
                      (session_id, json.dumps(data), time.time()))
            conn.commit()
    except Exception as e:
        print(f"DB Write Error: {e}")

# --- PRECISE SYNC LOGIC ---
# We use an "Anchor Time" system.
# Instead of storing "current_time", we store:
# - anchor_time: The server timestamp when the last Play/Seek happened.
# - anchor_position: The song position (seconds) at that moment.
# - is_playing: Whether time is progressing.
#
# Current Time = anchor_position + (now - anchor_time) [if playing]

def format_session_response(data, user_id=None):
    now = time.time()
    
    # Calculate live time
    current_time = data.get('anchor_position', 0)
    if data.get('is_playing'):
        elapsed = now - data.get('anchor_time', now)
        current_time += elapsed # Exact server time
        
        # Add user specific latency if available
        if user_id:
            latencies = data.get('latencies', {})
            user_latency_ms = latencies.get(user_id, 0)
            current_time += (user_latency_ms / 1000.0)

    return {
        "sessionId": data.get('id'),
        "currentSong": data.get('current_song'),
        "isPlaying": data.get('is_playing'),
        "currentTime": current_time, # Calculated live
        "anchorTime": data.get('anchor_time'), # For client-side drift correction
        "anchorPosition": data.get('anchor_position'),
        "participantCount": len(data.get('participants', [])),
        "version": data.get('version', 0),
        "sequence": data.get('sequence', 0)
    }

# --- Routes ---

@app.route('/')
def home():
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Jamify Server Status</title>
        <style>
            body { font-family: sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; background: #121212; color: #e0e0e0; }
            h1 { color: #1db954; }
            .card { background: #1e1e1e; padding: 1.5rem; border-radius: 8px; margin-bottom: 1rem; border: 1px solid #333; }
            .status { font-weight: bold; }
            .success { color: #4caf50; }
            .error { color: #f44336; }
            button { background: #1db954; color: white; border: none; padding: 0.5rem 1rem; border-radius: 20px; cursor: pointer; font-weight: bold; }
            button:hover { background: #1ed760; }
            pre { background: #000; padding: 1rem; overflow-x: auto; border-radius: 4px; }
        </style>
    </head>
    <body>
        <h1>🎵 Jamify Server Status</h1>
        
        <div class="card">
            <h2>System Health</h2>
            <p>Status: <span id="health-status">Checking...</span></p>
            <p>Database: <span id="db-status">Checking...</span></p>
        </div>

        <div class="card">
            <h2>Diagnostics</h2>
            <button onclick="runDiagnostics()">Run Self-Test</button>
            <div id="results" style="margin-top: 1rem;"></div>
        </div>

        <script>
            async function checkHealth() {
                try {
                    const res = await fetch('/api/health');
                    const data = await res.json();
                    document.getElementById('health-status').innerHTML = '<span class="success">ONLINE</span>';
                    document.getElementById('health-status').title = JSON.stringify(data);
                } catch (e) {
                    document.getElementById('health-status').innerHTML = '<span class="error">OFFLINE (' + e.message + ')</span>';
                }
                
                document.getElementById('db-status').innerHTML = '<span class="success">CONNECTED</span>'; 
            }

            async function runDiagnostics() {
                const results = document.getElementById('results');
                results.innerHTML = 'Running tests...';
                
                let log = '';
                const addLog = (msg, type='info') => {
                    const color = type === 'error' ? '#f44336' : (type === 'success' ? '#4caf50' : '#e0e0e0');
                    log += `<div style="color: ${color}; margin-bottom: 5px;">${msg}</div>`;
                    results.innerHTML = log;
                };

                addLog('Testing YouTube Search...', 'info');
                try {
                    const t0 = performance.now();
                    const res = await fetch('/api/search?q=never+gonna+give+you+up');
                    const t1 = performance.now();
                    
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const data = await res.json();
                    
                    if (Array.isArray(data) && data.length > 0) {
                        addLog(`✅ Search Success (${Math.round(t1-t0)}ms). Found ${data.length} results.`, 'success');
                    } else {
                        addLog('⚠️ Search returned empty list.', 'error');
                    }
                } catch (e) {
                    addLog(`❌ Search Failed: ${e.message}`, 'error');
                }

                addLog('Testing Jam Session Creation...', 'info');
                try {
                    const res = await fetch('/api/jam/create', { method: 'POST' });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const data = await res.json();
                    
                    if (data.sessionId) {
                        addLog(`✅ Jam Creation Success. ID: ${data.sessionId}`, 'success');
                    } else {
                        addLog('⚠️ Jam Creation returned invalid data.', 'error');
                    }
                } catch (e) {
                    addLog(`❌ Jam Creation Failed: ${e.message}`, 'error');
                }
            }

            checkHealth();
        </script>
    </body>
    </html>
    """

@app.route('/api/health')
def health():
    return jsonify({"status": "ok", "mode": "tick_sync"})

@app.route('/api/search', methods=['GET'])
def search():
    query = request.args.get('q')
    if not query:
        return jsonify({"error": "Query required"}), 400

    # 1. Try Official YouTube API (Fastest & Best)
    if YOUTUBE_API_KEY:
        try:
            url = f"https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q={requests.utils.quote(query)}&type=video&key={YOUTUBE_API_KEY}"
            res = requests.get(url, timeout=5)
            if res.status_code == 200:
                data = res.json()
                songs = []
                for item in data.get('items', []):
                    songs.append({
                        "id": item['id']['videoId'],
                        "title": item['snippet']['title'],
                        "artist": item['snippet']['channelTitle'],
                        "cover": item['snippet']['thumbnails']['high']['url'],
                        "url": f"https://www.youtube.com/watch?v={item['id']['videoId']}",
                        "duration": 0
                    })
                return jsonify(songs)
        except Exception as e:
            print(f"YouTube API Failed: {e}")

    # 2. Fallback to yt-dlp
    try:
        ydl_opts = {
            'quiet': True,
            'default_search': 'ytsearch5', 
            'skip_download': True,
            'extract_flat': True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(query, download=False)
            songs = []
            if 'entries' in info:
                for entry in info['entries']:
                    if entry: 
                        songs.append({
                            "id": entry.get('id'),
                            "title": entry.get('title'),
                            "artist": entry.get('uploader', 'Unknown'),
                            "cover": f"https://i.ytimg.com/vi/{entry.get('id')}/hqdefault.jpg",
                            "url": entry.get('url'),
                            "duration": entry.get('duration', 0)
                        })
            return jsonify(songs)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/jam/create', methods=['POST'])
def create_session():
    try:
        session_id = str(int(100000 + time.time() % 900000))
        user_id = str(uuid.uuid4())
        
        session_data = {
            "id": session_id,
            "host_id": user_id,
            "current_song": None,
            "is_playing": False,
            "anchor_time": time.time(),
            "anchor_position": 0.0,
            "participants": [user_id],
            "version": 1,
            "sequence": 1
        }
        
        save_session(session_id, session_data)
        return jsonify({
            "sessionId": session_id,
            "userId": user_id,
            "state": format_session_response(session_data, user_id)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/jam/join', methods=['POST'])
def join_session():
    try:
        data = request.json
        session_id = data.get('sessionId')
        session_data = get_session(session_id)
        if not session_data:
            return jsonify({"error": "Session not found"}), 404
            
        user_id = str(uuid.uuid4())
        if user_id not in session_data['participants']:
            session_data['participants'].append(user_id)
            session_data['version'] += 1
            save_session(session_id, session_data)
        
        return jsonify({
            "sessionId": session_id,
            "userId": user_id,
            "state": format_session_response(session_data, user_id)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/jam/state/<session_id>', methods=['GET'])
def get_state(session_id):
    user_id = request.args.get('userId')
    session_data = get_session(session_id)
    if not session_data:
        return jsonify({"error": "Session not found"}), 404
    return jsonify(format_session_response(session_data, user_id))

@app.route('/api/jam/calibrate', methods=['POST'])
def calibrate():
    try:
        data = request.json
        session_id = data.get('sessionId')
        user_id = data.get('userId')
        latency_ms = data.get('latencyMs', 0)
        
        session_data = get_session(session_id)
        if not session_data:
            return jsonify({"error": "Session not found"}), 404
            
        if 'latencies' not in session_data:
            session_data['latencies'] = {}
            
        session_data['latencies'][user_id] = latency_ms
        save_session(session_id, session_data)
        
        return jsonify({"status": "ok", "latencyMs": latency_ms})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/jam/update', methods=['POST'])
def update_state():
    try:
        data = request.json
        session_id = data.get('sessionId')
        payload = data.get('payload')
        
        session_data = get_session(session_id)
        if not session_data:
            return jsonify({"error": "Session not found"}), 404
            
        now = time.time()
        action_occurred = False

        # 1. Update Song
        if 'currentSong' in payload:
            session_data['current_song'] = payload['currentSong']
            # New song starts at 0
            session_data['anchor_position'] = 0.0
            session_data['anchor_time'] = now
            session_data['is_playing'] = True # Auto-play on new song
            action_occurred = True

        # 2. Update Play/Pause
        if 'isPlaying' in payload:
            new_state = payload['isPlaying']
            if session_data['is_playing'] != new_state:
                # State change!
                # Calculate where we were right now
                elapsed = now - session_data['anchor_time']
                current_pos = session_data['anchor_position'] + (elapsed if session_data['is_playing'] else 0)
                
                # Update anchor
                session_data['anchor_position'] = current_pos
                session_data['anchor_time'] = now
                session_data['is_playing'] = new_state
                action_occurred = True

        # 3. Update Seek (Time)
        if 'currentTime' in payload:
            # Seek resets the anchor
            session_data['anchor_position'] = payload['currentTime']
            session_data['anchor_time'] = now
            action_occurred = True

        session_data['version'] += 1
        if action_occurred:
            session_data['sequence'] = session_data.get('sequence', 0) + 1

        save_session(session_id, session_data)
        return jsonify(format_session_response(session_data))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    init_db()
    app.run(port=3000)
