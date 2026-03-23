const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const PORT = process.env.PORT;
if (!PORT) {
  console.error('ERROR: PORT environment variable is required');
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// In-memory store
const rooms = new Map();     // roomId -> { id, name, createdAt }
const messages = new Map();  // roomId -> [{ id, userId, nickname, text, timestamp }]
const clients = new Map();   // ws -> { id, nickname, roomId }

function createRoom(name) {
  const id = uuidv4();
  rooms.set(id, { id, name: sanitize(name), createdAt: Date.now() });
  messages.set(id, []);
  return rooms.get(id);
}

function sanitize(str) {
  return String(str).replace(/[<>&"']/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
  }[c])).trim();
}

function getRoomClients(roomId) {
  const result = [];
  for (const [ws, client] of clients.entries()) {
    if (client.roomId === roomId && ws.readyState === WebSocket.OPEN) {
      result.push({ id: client.id, nickname: client.nickname });
    }
  }
  return result;
}

function broadcast(roomId, data, excludeWs = null) {
  const payload = JSON.stringify(data);
  for (const [ws, client] of clients.entries()) {
    if (client.roomId === roomId && ws.readyState === WebSocket.OPEN && ws !== excludeWs) {
      ws.send(payload);
    }
  }
}

function broadcastRoomList() {
  const roomList = Array.from(rooms.values()).map(r => ({
    ...r,
    memberCount: getRoomClients(r.id).length
  }));
  const payload = JSON.stringify({ type: 'room_list', rooms: roomList });
  for (const [ws] of clients.entries()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

// Initialize default room
createRoom('General');

// REST: get rooms (for initial load)
app.get('/api/rooms', (req, res) => {
  const roomList = Array.from(rooms.values()).map(r => ({
    ...r,
    memberCount: getRoomClients(r.id).length
  }));
  res.json(roomList);
});

// WebSocket
wss.on('connection', (ws) => {
  const clientId = uuidv4();
  clients.set(ws, { id: clientId, nickname: null, roomId: null });

  ws.send(JSON.stringify({ type: 'connected', clientId }));

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }

    const client = clients.get(ws);

    switch (msg.type) {
      case 'set_nickname': {
        const nick = sanitize(msg.nickname || '');
        if (!nick || nick.length < 1 || nick.length > 20) {
          ws.send(JSON.stringify({ type: 'error', message: '닉네임은 1~20자여야 합니다.' }));
          return;
        }
        client.nickname = nick;
        ws.send(JSON.stringify({ type: 'nickname_set', nickname: nick }));
        broadcastRoomList();
        break;
      }

      case 'join_room': {
        if (!client.nickname) {
          ws.send(JSON.stringify({ type: 'error', message: '닉네임을 먼저 설정하세요.' }));
          return;
        }
        const roomId = msg.roomId;
        if (!rooms.has(roomId)) {
          ws.send(JSON.stringify({ type: 'error', message: '존재하지 않는 채팅방입니다.' }));
          return;
        }

        // Leave previous room
        if (client.roomId) {
          const prevRoom = client.roomId;
          client.roomId = null;
          broadcast(prevRoom, { type: 'user_left', userId: client.id, nickname: client.nickname, members: getRoomClients(prevRoom) });
          broadcastRoomList();
        }

        client.roomId = roomId;

        // Send history (last 50)
        const history = (messages.get(roomId) || []).slice(-50);
        ws.send(JSON.stringify({ type: 'room_joined', roomId, room: rooms.get(roomId), history, members: getRoomClients(roomId) }));

        // Notify others
        broadcast(roomId, { type: 'user_joined', userId: client.id, nickname: client.nickname, members: getRoomClients(roomId) }, ws);
        broadcastRoomList();
        break;
      }

      case 'leave_room': {
        if (!client.roomId) return;
        const prevRoom = client.roomId;
        client.roomId = null;
        broadcast(prevRoom, { type: 'user_left', userId: client.id, nickname: client.nickname, members: getRoomClients(prevRoom) });
        ws.send(JSON.stringify({ type: 'room_left' }));
        broadcastRoomList();
        break;
      }

      case 'create_room': {
        if (!client.nickname) {
          ws.send(JSON.stringify({ type: 'error', message: '닉네임을 먼저 설정하세요.' }));
          return;
        }
        const roomName = sanitize(msg.name || '');
        if (!roomName || roomName.length < 1 || roomName.length > 30) {
          ws.send(JSON.stringify({ type: 'error', message: '채팅방 이름은 1~30자여야 합니다.' }));
          return;
        }
        const newRoom = createRoom(roomName);
        broadcastRoomList();
        ws.send(JSON.stringify({ type: 'room_created', room: newRoom }));
        break;
      }

      case 'send_message': {
        if (!client.nickname) {
          ws.send(JSON.stringify({ type: 'error', message: '닉네임을 먼저 설정하세요.' }));
          return;
        }
        if (!client.roomId) {
          ws.send(JSON.stringify({ type: 'error', message: '채팅방에 먼저 입장하세요.' }));
          return;
        }
        const text = sanitize(msg.text || '');
        if (!text || text.length < 1 || text.length > 500) {
          ws.send(JSON.stringify({ type: 'error', message: '메시지는 1~500자여야 합니다.' }));
          return;
        }
        const message = {
          id: uuidv4(),
          userId: client.id,
          nickname: client.nickname,
          text,
          timestamp: Date.now()
        };
        messages.get(client.roomId).push(message);

        // Keep only last 200 messages per room
        if (messages.get(client.roomId).length > 200) {
          messages.get(client.roomId).splice(0, messages.get(client.roomId).length - 200);
        }

        const payload = { type: 'new_message', message };
        ws.send(JSON.stringify(payload));
        broadcast(client.roomId, payload, ws);
        break;
      }

      case 'typing': {
        if (!client.nickname || !client.roomId) return;
        broadcast(client.roomId, {
          type: 'typing',
          userId: client.id,
          nickname: client.nickname,
          isTyping: !!msg.isTyping
        }, ws);
        break;
      }

      default:
        ws.send(JSON.stringify({ type: 'error', message: '알 수 없는 메시지 타입입니다.' }));
    }
  });

  ws.on('close', () => {
    const client = clients.get(ws);
    if (client && client.roomId) {
      broadcast(client.roomId, { type: 'user_left', userId: client.id, nickname: client.nickname, members: getRoomClients(client.roomId) });
    }
    clients.delete(ws);
    broadcastRoomList();
  });
});

server.listen(PORT, () => {
  console.log(`Chat server running on http://localhost:${PORT}`);
});
