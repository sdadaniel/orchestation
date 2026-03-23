const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// In-memory store
const rooms = new Map(); // roomId -> { id, name, messages[], createdAt }
const clients = new Map(); // ws -> { id, nickname, roomId }

// Default room
const defaultRoom = { id: 'general', name: '일반', messages: [], createdAt: Date.now() };
rooms.set('general', defaultRoom);

function broadcast(roomId, data, excludeWs = null) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      const client = clients.get(ws);
      if (client && client.roomId === roomId && ws !== excludeWs) {
        ws.send(msg);
      }
    }
  });
}

function broadcastAll(data, excludeWs = null) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN && ws !== excludeWs) {
      ws.send(msg);
    }
  });
}

function getRoomList() {
  return Array.from(rooms.values()).map(r => ({
    id: r.id,
    name: r.name,
    createdAt: r.createdAt,
    userCount: [...clients.values()].filter(c => c.roomId === r.id).length
  }));
}

function getOnlineUsers(roomId) {
  return [...clients.values()]
    .filter(c => c.roomId === roomId)
    .map(c => ({ id: c.id, nickname: c.nickname }));
}

function sendTo(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

wss.on('connection', (ws) => {
  const clientId = uuidv4();
  clients.set(ws, { id: clientId, nickname: null, roomId: null });

  sendTo(ws, { type: 'connected', id: clientId, rooms: getRoomList() });

  ws.on('message', (raw) => {
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    const client = clients.get(ws);
    if (!client) return;

    switch (data.type) {
      case 'set_nickname': {
        const nickname = String(data.nickname || '').trim().slice(0, 20);
        if (!nickname) return;
        client.nickname = nickname;
        sendTo(ws, { type: 'nickname_set', nickname });
        broadcastAll({ type: 'room_list', rooms: getRoomList() });
        break;
      }

      case 'create_room': {
        const name = String(data.name || '').trim().slice(0, 30);
        if (!name || !client.nickname) return;
        const roomId = uuidv4().slice(0, 8);
        const room = { id: roomId, name, messages: [], createdAt: Date.now() };
        rooms.set(roomId, room);
        broadcastAll({ type: 'room_list', rooms: getRoomList() });
        sendTo(ws, { type: 'room_created', roomId });
        break;
      }

      case 'join_room': {
        const { roomId } = data;
        if (!rooms.has(roomId) || !client.nickname) return;

        const prevRoom = client.roomId;
        if (prevRoom && prevRoom !== roomId) {
          broadcast(prevRoom, {
            type: 'user_left',
            userId: client.id,
            nickname: client.nickname,
            onlineUsers: getOnlineUsers(prevRoom).filter(u => u.id !== client.id)
          });
        }

        client.roomId = roomId;
        const room = rooms.get(roomId);
        const recent = room.messages.slice(-50);

        sendTo(ws, {
          type: 'room_joined',
          roomId,
          roomName: room.name,
          messages: recent,
          onlineUsers: getOnlineUsers(roomId)
        });

        broadcast(roomId, {
          type: 'user_joined',
          userId: client.id,
          nickname: client.nickname,
          onlineUsers: getOnlineUsers(roomId)
        }, ws);

        broadcastAll({ type: 'room_list', rooms: getRoomList() });
        break;
      }

      case 'leave_room': {
        if (!client.roomId) return;
        const prevRoom = client.roomId;
        client.roomId = null;

        broadcast(prevRoom, {
          type: 'user_left',
          userId: client.id,
          nickname: client.nickname,
          onlineUsers: getOnlineUsers(prevRoom)
        });

        sendTo(ws, { type: 'room_left' });
        broadcastAll({ type: 'room_list', rooms: getRoomList() });
        break;
      }

      case 'message': {
        if (!client.roomId || !client.nickname) return;
        const text = String(data.text || '').trim().slice(0, 1000);
        if (!text) return;

        const msg = {
          id: uuidv4(),
          userId: client.id,
          nickname: client.nickname,
          text,
          timestamp: Date.now()
        };

        const room = rooms.get(client.roomId);
        room.messages.push(msg);
        if (room.messages.length > 200) room.messages.shift();

        const payload = { type: 'message', ...msg, roomId: client.roomId };
        broadcast(client.roomId, payload);
        sendTo(ws, payload);
        break;
      }

      case 'typing': {
        if (!client.roomId || !client.nickname) return;
        broadcast(client.roomId, {
          type: 'typing',
          userId: client.id,
          nickname: client.nickname,
          isTyping: !!data.isTyping
        }, ws);
        break;
      }
    }
  });

  ws.on('close', () => {
    const client = clients.get(ws);
    if (client && client.roomId) {
      broadcast(client.roomId, {
        type: 'user_left',
        userId: client.id,
        nickname: client.nickname,
        onlineUsers: getOnlineUsers(client.roomId).filter(u => u.id !== client.id)
      });
    }
    clients.delete(ws);
    broadcastAll({ type: 'room_list', rooms: getRoomList() });
  });
});

server.listen(PORT, () => {
  console.log(`Chat server running on http://localhost:${PORT}`);
});
