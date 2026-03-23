(() => {
  'use strict';

  // ── State ────────────────────────────────────────────
  let ws = null;
  let myId = null;
  let myNickname = null;
  let currentRoomId = null;
  let rooms = [];
  let typingUsers = {};   // userId -> timer
  let typingTimeout = null;
  let isTypingSent = false;

  // ── DOM refs ──────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const nickOverlay   = $('nickname-overlay');
  const nickInput     = $('nick-input');
  const nickBtn       = $('nick-btn');
  const nickError     = $('nick-error');
  const myNickDisplay = $('my-nick-display');

  const modalOverlay  = $('modal-overlay');
  const roomNameInput = $('room-name-input');
  const modalError    = $('modal-error');
  const modalCancel   = $('modal-cancel');
  const modalConfirm  = $('modal-confirm');

  const createRoomBtn = $('create-room-btn');
  const roomList      = $('room-list');
  const onlinePanel   = $('online-panel');

  const emptyState    = $('empty-state');
  const chatHeader    = $('chat-header');
  const headerRoomName= $('header-room-name');
  const headerRoomMeta= $('header-room-meta');
  const leaveBtn      = $('leave-btn');

  const chatArea      = $('chat-area');
  const typingIndicator = $('typing-indicator');
  const inputArea     = $('input-area');
  const msgInput      = $('msg-input');
  const sendBtn       = $('send-btn');

  // ── WebSocket ─────────────────────────────────────────
  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}`);

    ws.onopen = () => console.log('[WS] connected');

    ws.onmessage = e => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      handleServer(msg);
    };

    ws.onclose = () => {
      console.log('[WS] disconnected, reconnecting in 2s...');
      setTimeout(connect, 2000);
    };

    ws.onerror = err => console.error('[WS] error', err);
  }

  function send(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }

  // ── Server message handler ────────────────────────────
  function handleServer(msg) {
    switch (msg.type) {
      case 'connected':
        myId = msg.clientId;
        break;

      case 'nickname_set':
        myNickname = msg.nickname;
        myNickDisplay.textContent = '@' + myNickname;
        nickOverlay.classList.add('hidden');
        break;

      case 'error':
        showError(msg.message);
        break;

      case 'room_list':
        rooms = msg.rooms;
        renderRoomList();
        break;

      case 'room_created':
        // Auto join newly created room
        send({ type: 'join_room', roomId: msg.room.id });
        break;

      case 'room_joined': {
        currentRoomId = msg.roomId;
        showChatUI(msg.room, msg.members);
        renderHistory(msg.history);
        renderOnlineUsers(msg.members);
        renderRoomList();
        break;
      }

      case 'room_left':
        currentRoomId = null;
        hideChatUI();
        renderOnlineUsers([]);
        renderRoomList();
        break;

      case 'new_message':
        appendMessage(msg.message);
        break;

      case 'user_joined':
        appendSystem(`${msg.nickname}님이 입장했습니다.`);
        renderOnlineUsers(msg.members);
        updateRoomMeta(msg.members);
        break;

      case 'user_left':
        appendSystem(`${msg.nickname}님이 퇴장했습니다.`);
        renderOnlineUsers(msg.members);
        updateRoomMeta(msg.members);
        // Remove typing
        delete typingUsers[msg.userId];
        renderTyping();
        break;

      case 'typing':
        if (msg.userId === myId) break;
        if (msg.isTyping) {
          clearTimeout(typingUsers[msg.userId]);
          typingUsers[msg.userId] = { nickname: msg.nickname, timer: setTimeout(() => {
            delete typingUsers[msg.userId];
            renderTyping();
          }, 3000) };
        } else {
          if (typingUsers[msg.userId]) {
            clearTimeout(typingUsers[msg.userId].timer);
            delete typingUsers[msg.userId];
          }
        }
        renderTyping();
        break;
    }
  }

  // ── UI Helpers ────────────────────────────────────────
  function showError(msg) {
    // Show in a transient banner (reuse nick-error area if overlay visible, else console)
    if (!nickOverlay.classList.contains('hidden')) {
      nickError.textContent = msg;
    } else {
      modalError.textContent = msg;
      setTimeout(() => { modalError.textContent = ''; }, 3000);
    }
  }

  function showChatUI(room, members) {
    emptyState.classList.add('hidden');
    chatHeader.classList.remove('hidden');
    chatArea.classList.remove('hidden');
    inputArea.classList.remove('hidden');
    typingIndicator.classList.remove('hidden');
    chatArea.innerHTML = '';
    typingUsers = {};
    renderTyping();

    headerRoomName.textContent = '# ' + room.name;
    updateRoomMeta(members);
    msgInput.focus();
  }

  function hideChatUI() {
    emptyState.classList.remove('hidden');
    chatHeader.classList.add('hidden');
    chatArea.classList.add('hidden');
    inputArea.classList.add('hidden');
    typingIndicator.classList.add('hidden');
  }

  function updateRoomMeta(members) {
    headerRoomMeta.textContent = `${members.length}명 온라인`;
  }

  function renderRoomList() {
    roomList.innerHTML = '';
    rooms.forEach(room => {
      const el = document.createElement('div');
      el.className = 'room-item' + (room.id === currentRoomId ? ' active' : '');
      el.innerHTML = `
        <span class="room-name"># ${escHtml(room.name)}</span>
        <span class="member-count">${room.memberCount}</span>
      `;
      el.addEventListener('click', () => {
        if (room.id !== currentRoomId) {
          send({ type: 'join_room', roomId: room.id });
        }
      });
      roomList.appendChild(el);
    });
  }

  function renderOnlineUsers(members) {
    onlinePanel.innerHTML = '';
    members.forEach(m => {
      const el = document.createElement('div');
      el.className = 'online-user';
      el.innerHTML = `<span class="online-dot"></span><span>${escHtml(m.nickname)}${m.id === myId ? ' (나)' : ''}</span>`;
      onlinePanel.appendChild(el);
    });
  }

  function renderHistory(history) {
    chatArea.innerHTML = '';
    history.forEach(m => appendMessage(m, false));
    scrollBottom();
  }

  function appendMessage(msg, scroll = true) {
    const isSelf = msg.userId === myId;
    const wrap = document.createElement('div');
    wrap.className = 'msg-wrap ' + (isSelf ? 'self' : 'other');
    wrap.dataset.msgId = msg.id;

    const time = formatTime(msg.timestamp);
    wrap.innerHTML = `
      ${!isSelf ? `<div class="msg-nick">${escHtml(msg.nickname)}</div>` : ''}
      <div class="msg-bubble">${escHtml(msg.text)}</div>
      <div class="msg-time">${time}</div>
    `;
    chatArea.appendChild(wrap);
    if (scroll) scrollBottom();
  }

  function appendSystem(text) {
    const el = document.createElement('div');
    el.className = 'system-msg';
    el.textContent = text;
    chatArea.appendChild(el);
    scrollBottom();
  }

  function renderTyping() {
    const users = Object.values(typingUsers);
    if (users.length === 0) {
      typingIndicator.textContent = '';
    } else if (users.length === 1) {
      typingIndicator.textContent = `${users[0].nickname}님이 입력 중...`;
    } else {
      const names = users.map(u => u.nickname).join(', ');
      typingIndicator.textContent = `${names}님이 입력 중...`;
    }
  }

  function scrollBottom() {
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── Nickname ──────────────────────────────────────────
  function submitNickname() {
    const nick = nickInput.value.trim();
    nickError.textContent = '';
    if (!nick || nick.length < 1 || nick.length > 20) {
      nickError.textContent = '닉네임은 1~20자여야 합니다.';
      return;
    }
    send({ type: 'set_nickname', nickname: nick });
  }

  nickBtn.addEventListener('click', submitNickname);
  nickInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitNickname(); });

  // ── Create Room Modal ─────────────────────────────────
  createRoomBtn.addEventListener('click', () => {
    roomNameInput.value = '';
    modalError.textContent = '';
    modalOverlay.classList.remove('hidden');
    roomNameInput.focus();
  });

  modalCancel.addEventListener('click', () => modalOverlay.classList.add('hidden'));
  modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) modalOverlay.classList.add('hidden'); });

  function submitCreateRoom() {
    const name = roomNameInput.value.trim();
    modalError.textContent = '';
    if (!name || name.length < 1 || name.length > 30) {
      modalError.textContent = '채팅방 이름은 1~30자여야 합니다.';
      return;
    }
    send({ type: 'create_room', name });
    modalOverlay.classList.add('hidden');
  }

  modalConfirm.addEventListener('click', submitCreateRoom);
  roomNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitCreateRoom(); });

  // ── Leave Room ────────────────────────────────────────
  leaveBtn.addEventListener('click', () => {
    send({ type: 'leave_room' });
  });

  // ── Send Message ──────────────────────────────────────
  function submitMessage() {
    const text = msgInput.value.trim();
    if (!text) return;
    if (text.length > 500) {
      return;
    }
    send({ type: 'send_message', text });
    msgInput.value = '';
    msgInput.style.height = 'auto';
    stopTyping();
  }

  sendBtn.addEventListener('click', submitMessage);

  msgInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitMessage();
    }
  });

  // Auto-resize textarea
  msgInput.addEventListener('input', () => {
    msgInput.style.height = 'auto';
    msgInput.style.height = Math.min(msgInput.scrollHeight, 120) + 'px';
    handleTyping();
  });

  // ── Typing indicator ──────────────────────────────────
  function handleTyping() {
    if (!currentRoomId) return;
    if (!isTypingSent) {
      isTypingSent = true;
      send({ type: 'typing', isTyping: true });
    }
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(stopTyping, 2000);
  }

  function stopTyping() {
    if (isTypingSent) {
      isTypingSent = false;
      send({ type: 'typing', isTyping: false });
    }
    clearTimeout(typingTimeout);
  }

  // ── Boot ──────────────────────────────────────────────
  connect();
})();
