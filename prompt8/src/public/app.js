(() => {
  // ── STATE ──
  let ws = null;
  let myId = null;
  let myNickname = null;
  let currentRoomId = null;
  let typingTimer = null;
  let isTyping = false;
  const typingUsers = new Map(); // userId -> { nickname, timer }

  // ── DOM ──
  const $ = id => document.getElementById(id);
  const nicknameModal = $('nickname-modal');
  const nicknameInput = $('nickname-input');
  const nicknameBtn = $('nickname-btn');
  const appEl = $('app');
  const myNicknameEl = $('my-nickname');
  const roomListEl = $('room-list');
  const createRoomBtn = $('create-room-btn');
  const createRoomForm = $('create-room-form');
  const roomNameInput = $('room-name-input');
  const createRoomSubmit = $('create-room-submit');
  const createRoomCancel = $('create-room-cancel');
  const noRoom = $('no-room');
  const roomView = $('room-view');
  const currentRoomName = $('current-room-name');
  const onlineCount = $('online-count');
  const leaveRoomBtn = $('leave-room-btn');
  const messagesEl = $('messages');
  const chatBody = document.querySelector('.chat-body');
  const typingIndicator = $('typing-indicator');
  const onlineUsersEl = $('online-users');
  const messageInput = $('message-input');
  const sendBtn = $('send-btn');

  // ── WS CONNECTION ──
  function connect() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${proto}//${location.host}`);

    ws.addEventListener('open', () => {
      console.log('WebSocket connected');
    });

    ws.addEventListener('message', e => {
      try {
        handleMessage(JSON.parse(e.data));
      } catch {}
    });

    ws.addEventListener('close', () => {
      setTimeout(connect, 2000);
    });
  }

  function send(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  // ── MESSAGE HANDLERS ──
  function handleMessage(data) {
    switch (data.type) {
      case 'connected':
        myId = data.id;
        renderRoomList(data.rooms);
        break;

      case 'nickname_set':
        myNickname = data.nickname;
        myNicknameEl.textContent = `@ ${myNickname}`;
        break;

      case 'room_list':
        renderRoomList(data.rooms);
        break;

      case 'room_created':
        send({ type: 'join_room', roomId: data.roomId });
        break;

      case 'room_joined':
        currentRoomId = data.roomId;
        currentRoomName.textContent = `# ${data.roomName}`;
        messagesEl.innerHTML = '';
        typingUsers.clear();
        updateTypingIndicator();
        data.messages.forEach(m => appendMessage(m, false));
        renderOnlineUsers(data.onlineUsers);
        showRoomView();
        scrollToBottom(false);
        break;

      case 'room_left':
        currentRoomId = null;
        showNoRoom();
        break;

      case 'message':
        if (data.roomId === currentRoomId) {
          appendMessage(data, true);
        }
        break;

      case 'user_joined':
        if (data.userId !== myId) {
          appendSystem(`${data.nickname}님이 입장했습니다.`);
        }
        renderOnlineUsers(data.onlineUsers);
        break;

      case 'user_left':
        if (data.userId !== myId) {
          appendSystem(`${data.nickname}님이 퇴장했습니다.`);
        }
        renderOnlineUsers(data.onlineUsers);
        // Clear their typing
        if (typingUsers.has(data.userId)) {
          clearTimeout(typingUsers.get(data.userId).timer);
          typingUsers.delete(data.userId);
          updateTypingIndicator();
        }
        break;

      case 'typing':
        if (data.userId === myId) break;
        if (data.isTyping) {
          if (typingUsers.has(data.userId)) {
            clearTimeout(typingUsers.get(data.userId).timer);
          }
          const timer = setTimeout(() => {
            typingUsers.delete(data.userId);
            updateTypingIndicator();
          }, 3000);
          typingUsers.set(data.userId, { nickname: data.nickname, timer });
        } else {
          if (typingUsers.has(data.userId)) {
            clearTimeout(typingUsers.get(data.userId).timer);
            typingUsers.delete(data.userId);
          }
        }
        updateTypingIndicator();
        break;
    }
  }

  // ── RENDER ──
  function renderRoomList(rooms) {
    roomListEl.innerHTML = '';
    rooms.forEach(room => {
      const el = document.createElement('div');
      el.className = 'room-item' + (room.id === currentRoomId ? ' active' : '');
      el.innerHTML = `
        <span class="room-item-name"># ${escHtml(room.name)}</span>
        <span class="room-item-count">${room.userCount}</span>
      `;
      el.addEventListener('click', () => {
        if (room.id !== currentRoomId) {
          send({ type: 'join_room', roomId: room.id });
        }
      });
      roomListEl.appendChild(el);
    });
  }

  function renderOnlineUsers(users) {
    onlineCount.textContent = `● ${users.length}명 온라인`;
    onlineUsersEl.innerHTML = '';
    users.forEach(u => {
      const el = document.createElement('div');
      el.className = 'online-user';
      const isMe = u.id === myId;
      el.innerHTML = `
        <span class="online-dot"></span>
        <span class="online-user-name ${isMe ? 'is-me' : ''}">${escHtml(u.nickname)}${isMe ? ' (나)' : ''}</span>
      `;
      onlineUsersEl.appendChild(el);
    });
  }

  function appendMessage(msg, scroll) {
    const isOwn = msg.userId === myId;
    const el = document.createElement('div');
    el.className = `msg ${isOwn ? 'own' : 'other'}`;
    const time = formatTime(msg.timestamp);
    el.innerHTML = `
      <div class="msg-meta">${isOwn ? '' : escHtml(msg.nickname)}</div>
      <div class="msg-bubble">${escHtml(msg.text)}</div>
      <div class="msg-time">${time}</div>
    `;
    messagesEl.appendChild(el);
    if (scroll) scrollToBottom(true);
  }

  function appendSystem(text) {
    const el = document.createElement('div');
    el.className = 'msg-system';
    el.textContent = text;
    messagesEl.appendChild(el);
    scrollToBottom(true);
  }

  function updateTypingIndicator() {
    const users = [...typingUsers.values()];
    if (users.length === 0) {
      typingIndicator.classList.add('hidden');
      typingIndicator.innerHTML = '';
    } else {
      typingIndicator.classList.remove('hidden');
      const names = users.map(u => escHtml(u.nickname)).join(', ');
      const label = users.length === 1 ? `${names}님이 입력 중` : `${names}이 입력 중`;
      typingIndicator.innerHTML = `
        <div class="typing-dots"><span></span><span></span><span></span></div>
        ${label}
      `;
    }
  }

  function showRoomView() {
    noRoom.classList.add('hidden');
    roomView.classList.remove('hidden');
    // Update active in sidebar
    document.querySelectorAll('.room-item').forEach(el => el.classList.remove('active'));
    const active = [...document.querySelectorAll('.room-item')].find(el =>
      el.querySelector('.room-item-name')?.textContent.slice(2) === currentRoomName.textContent.slice(2)
    );
    if (active) active.classList.add('active');
  }

  function showNoRoom() {
    noRoom.classList.remove('hidden');
    roomView.classList.add('hidden');
  }

  function scrollToBottom(smooth) {
    chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
  }

  // ── HELPERS ──
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  // ── EVENT LISTENERS ──

  // Nickname
  function submitNickname() {
    const nick = nicknameInput.value.trim();
    if (!nick) return;
    nicknameModal.classList.add('hidden');
    appEl.classList.remove('hidden');
    send({ type: 'set_nickname', nickname: nick });
  }

  nicknameBtn.addEventListener('click', submitNickname);
  nicknameInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitNickname(); });

  // Create Room toggle
  createRoomBtn.addEventListener('click', () => {
    createRoomForm.classList.toggle('hidden');
    if (!createRoomForm.classList.contains('hidden')) roomNameInput.focus();
  });

  createRoomCancel.addEventListener('click', () => {
    createRoomForm.classList.add('hidden');
    roomNameInput.value = '';
  });

  function submitCreateRoom() {
    const name = roomNameInput.value.trim();
    if (!name) return;
    send({ type: 'create_room', name });
    roomNameInput.value = '';
    createRoomForm.classList.add('hidden');
  }

  createRoomSubmit.addEventListener('click', submitCreateRoom);
  roomNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitCreateRoom(); });

  // Leave Room
  leaveRoomBtn.addEventListener('click', () => {
    send({ type: 'leave_room' });
  });

  // Send Message
  function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentRoomId) return;
    send({ type: 'message', text });
    messageInput.value = '';
    // Stop typing
    if (isTyping) {
      isTyping = false;
      send({ type: 'typing', isTyping: false });
    }
    clearTimeout(typingTimer);
  }

  sendBtn.addEventListener('click', sendMessage);
  messageInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Typing indicator
  messageInput.addEventListener('input', () => {
    if (!currentRoomId) return;
    if (!isTyping) {
      isTyping = true;
      send({ type: 'typing', isTyping: true });
    }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      isTyping = false;
      send({ type: 'typing', isTyping: false });
    }, 2000);
  });

  // ── INIT ──
  connect();
  nicknameInput.focus();
})();
