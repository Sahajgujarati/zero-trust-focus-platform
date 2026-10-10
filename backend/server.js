const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// ── Database with local file persistence ──
const DB_FILE = path.join(__dirname, 'db.json');
let db = {
  rooms: {},
  users: {},
  logs: {},
};

try {
  if (fs.existsSync(DB_FILE)) {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.rooms === 'object') {
      db.rooms = parsed.rooms || {};
      db.users = parsed.users || {};
      db.logs = parsed.logs || {};
      console.log(`[Storage] Loaded ${Object.keys(db.rooms).length} saved rooms from db.json`);
    }
  }
} catch (e) {
  console.warn('[Storage] Notice: using clean memory state:', e.message);
}

let saveTimeout = null;
function saveDb() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
    } catch (err) {
      console.error('[Storage] Save failed:', err.message);
    }
  }, 1000);
}

// Helper: Normalize URL to extract hostname and path for clean matching
function extractHostAndPath(rawUrl) {
  if (!rawUrl) return '';
  let str = String(rawUrl).trim().toLowerCase();
  try {
    if (!str.startsWith('http://') && !str.startsWith('https://')) {
      str = 'https://' + str;
    }
    const parsed = new URL(str);
    const host = parsed.hostname.replace(/^www\./, '');
    const pathname = parsed.pathname.replace(/\/$/, '');
    return host + pathname;
  } catch (e) {
    return str.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
  }
}

// Helper: Robust Category Matching (Productive vs Distracting vs Untracked)
function matchCategory(url, productiveList, distractingList) {
  if (!url) return 'untracked';
  const cleanTarget = extractHostAndPath(url);

  // 1. Check Distracting Rules first
  if (Array.isArray(distractingList)) {
    for (const rule of distractingList) {
      const rawRule = typeof rule === 'string' ? rule : rule?.url || '';
      const cleanRule = extractHostAndPath(rawRule);
      if (cleanRule && (cleanTarget.includes(cleanRule) || cleanRule.includes(cleanTarget.split('/')[0]))) {
        return 'distracting';
      }
    }
  }

  // 2. Check Productive Rules
  if (Array.isArray(productiveList)) {
    for (const rule of productiveList) {
      const rawRule = typeof rule === 'string' ? rule : rule?.url || '';
      const cleanRule = extractHostAndPath(rawRule);
      if (cleanRule && (cleanTarget.includes(cleanRule) || cleanRule.includes(cleanTarget.split('/')[0]))) {
        return 'productive';
      }
    }
  }

  return 'untracked';
}


// Helper: Find room by ID or Name or Password
function findRoom(identifier) {
  if (!identifier) return null;
  const idStr = String(identifier).trim().toLowerCase();
  if (db.rooms[idStr]) return db.rooms[idStr];
  return Object.values(db.rooms).find(
    r => r.id.toLowerCase() === idStr ||
         r.name.toLowerCase() === idStr ||
         (r.password && r.password.toLowerCase() === idStr)
  ) || null;
}

// Helper: Format seconds to readable time string (days, hrs, mins, secs)
function formatMaxTime(secs) {
  if (!secs || secs <= 0) return '0s';
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0) parts.push(`${s}s`);
  return parts.length > 0 ? parts.join(' ') : '0s';
}

// ─── ROOMS API ────────────────────────────────────────────────────────────────

// GET all rooms
app.get('/api/rooms', (req, res) => {
  const roomsList = Object.values(db.rooms).map(room => {
    const roomUsers = (room.users || []).map(uId => db.users[uId]).filter(Boolean);
    const totalProdSec = roomUsers.reduce((acc, u) => acc + (u.productiveSec || 0), 0);
    const totalDistSec = roomUsers.reduce((acc, u) => acc + (u.distractingSec || 0), 0);

    return {
      id: room.id,
      name: room.name,
      userCount: roomUsers.length,
      productiveCount: (room.config?.productive || []).length,
      distractingCount: (room.config?.distracting || []).length,
      distractionIntervalSec: room.config?.distractionIntervalSec || 60,
      maxDistractionSec: room.config?.maxDistractionSec || null,
      config: room.config,
      totalProductiveSec: totalProdSec,
      totalDistractingSec: totalDistSec,
      createdAt: room.createdAt
    };
  });
  res.json(roomsList);
});

// CREATE room
app.post('/api/rooms', (req, res) => {
  const { name, password, config } = req.body;
  const roomId = 'room_' + Math.random().toString(36).substr(2, 9);
  const roomPassword = (password && password.trim()) || Math.random().toString(36).substr(2, 6);

  const cleanProductive = Array.isArray(config?.productive)
    ? config.productive.map(p => (typeof p === 'string' ? p : p.url || '').trim()).filter(Boolean)
    : ['codeforces.com', 'github.com', 'leetcode.com', 'stackoverflow.com'];

  const cleanDistracting = Array.isArray(config?.distracting)
    ? config.distracting.map(d => (typeof d === 'string' ? d : d.url || '').trim()).filter(Boolean)
    : ['youtube.com', 'instagram.com', 'twitter.com', 'facebook.com', 'reddit.com', 'netflix.com'];

  const intervalSec = Number(config?.distractionIntervalSec) > 0 ? Number(config?.distractionIntervalSec) : 60;

  // maxDistractionSec: null means unlimited; positive number = kick after that many seconds of total distracting time
  const maxDistractionSec = Number(config?.maxDistractionSec) > 0 ? Number(config?.maxDistractionSec) : null;

  db.rooms[roomId] = {
    id: roomId,
    name: (name && name.trim()) || 'Focus Room',
    password: roomPassword,
    users: [],
    bannedUsers: [], // lowercased usernames permanently banned from this room
    createdAt: new Date(),
    config: {
      productive: cleanProductive,
      distracting: cleanDistracting,
      distractionIntervalSec: intervalSec,
      maxDistractionSec: maxDistractionSec
    }
  };
  db.logs[roomId] = [];

  saveDb();
  io.emit('rooms_list_update');

  res.json(db.rooms[roomId]);
});

// VERIFY room password & join credentials
app.post('/api/rooms/verify', (req, res) => {
  const { roomId, password, username } = req.body;

  let room = findRoom(roomId) || findRoom(password);

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  if (room.password !== (password || '').trim() && room.name.toLowerCase() !== (password || '').trim().toLowerCase()) {
    return res.status(401).json({ error: 'Incorrect room password' });
  }

  // Check if user is permanently banned
  if (username && room.bannedUsers && room.bannedUsers.includes(username.trim().toLowerCase())) {
    return res.status(403).json({
      error: 'You have been permanently removed from this room due to excessive distraction time. You cannot re-enter.',
      banned: true
    });
  }

  res.json({
    success: true,
    room: {
      id: room.id,
      name: room.name,
      config: room.config
    }
  });
});

// GET specific room data
app.get('/api/rooms/:id', (req, res) => {
  const room = db.rooms[req.params.id];
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const roomData = {
    id: room.id,
    name: room.name,
    config: room.config,
    users: room.users.map(userId => db.users[userId]).filter(Boolean),
    logs: db.logs[req.params.id] || []
  };
  res.json(roomData);
});

// DELETE room (Requires room password)
app.delete('/api/rooms/:id', (req, res) => {
  const roomId = req.params.id;
  const { password } = req.body || {};

  const room = db.rooms[roomId];
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  if (!password || room.password !== password.trim()) {
    return res.status(403).json({ error: 'Incorrect room password.' });
  }

  // Remove users associated with room
  const userIds = room.users || [];
  userIds.forEach(uId => {
    delete db.users[uId];
  });

  delete db.logs[roomId];
  delete db.rooms[roomId];

  saveDb();
  io.to(roomId).emit('room_deleted', { roomId });
  io.emit('rooms_list_update');

  res.json({ success: true, message: 'Room deleted successfully' });
});

// ─── ACTIVITY & TIME TRACKING (from Chrome Extension Heartbeat) ───────────────

app.post('/api/activity', (req, res) => {
  const { roomId, password, username, url, elapsedSec } = req.body;

  if (!username || !url) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  let room = findRoom(roomId) || findRoom(password);
  if (!room) {
    console.warn(`[Activity] Room not found for identifier: "${roomId || password}" from user: "${username}"`);
    return res.status(404).json({ error: 'Room not found' });
  }

  const currentRoomId = room.id;
  const usernameLower = username.trim().toLowerCase();

  // Check if user is permanently banned
  if (room.bannedUsers && room.bannedUsers.includes(usernameLower)) {
    return res.status(403).json({
      kickedOut: true,
      banned: true,
      kickMessage: 'You have been permanently removed from this room due to excessive distraction time.'
    });
  }

  const now = Date.now();

  // Find or create user
  let userId = Object.keys(db.users).find(
    id => db.users[id].roomId === currentRoomId && db.users[id].username.toLowerCase() === usernameLower
  );

  if (!userId) {
    userId = 'user_' + Math.random().toString(36).substr(2, 9);
    db.users[userId] = {
      id: userId,
      username: username.trim(),
      roomId: currentRoomId,
      productiveSec: 0,
      distractingSec: 0,
      untrackedSec: 0,
      isFocused: true,
      currentCategory: 'untracked',
      currentUrl: url,
      lastHeartbeat: now,
      consecutiveDistractingSec: 0,
      alertCountForDistraction: 0
    };
    if (!room.users.includes(userId)) {
      room.users.push(userId);
    }
  }

  const user = db.users[userId];
  const previousCategory = user.currentCategory;
  const category = matchCategory(url, room.config.productive, room.config.distracting);

  // Compute time delta in seconds (default ~1s on periodic heartbeat, capped at 5s)
  const deltaSec = typeof elapsedSec === 'number' && elapsedSec > 0
    ? Math.min(5, elapsedSec)
    : Math.min(5, Math.max(1, Math.round((now - (user.lastHeartbeat || now)) / 1000) || 1));

  user.lastHeartbeat = now;
  user.currentUrl = url;
  user.currentCategory = category;

  let shouldTriggerAlert = false;
  let alertMessage = '';
  let alertType = 'none';
  let kickedOut = false;
  let kickMessage = '';

  const reminderInterval = room.config.distractionIntervalSec || 60;
  const maxDistractionSec = room.config.maxDistractionSec || null;

  if (category === 'productive') {
    user.productiveSec += deltaSec;
    user.isFocused = true;
    user.consecutiveDistractingSec = 0;
    user.alertCountForDistraction = 0;
    console.log(`[Activity] 👤 ${user.username} | ✅ PRODUCTIVE (+${deltaSec}s) | Total: ${user.productiveSec}s | URL: ${url.substring(0, 50)}`);
  } else if (category === 'distracting') {
    user.distractingSec += deltaSec;
    user.isFocused = false;
    user.consecutiveDistractingSec += deltaSec;
    console.log(`[Activity] 👤 ${user.username} | 🚫 DISTRACTING (+${deltaSec}s) | Total: ${user.distractingSec}s | URL: ${url.substring(0, 50)}`);


    // ── Check total distraction limit → KICK & BAN ──
    if (maxDistractionSec && user.distractingSec >= maxDistractionSec) {
      kickedOut = true;
      kickMessage = `You spent more than ${formatMaxTime(maxDistractionSec)} on distracting sites and have been permanently removed from the room.`;

      if (!room.bannedUsers.includes(usernameLower)) {
        room.bannedUsers.push(usernameLower);
      }

      // Remove from active users
      room.users = room.users.filter(uid => uid !== userId);
      delete db.users[userId];

      const kickLog = {
        id: 'log_' + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        username: username.trim(),
        url: url,
        category: 'distracting',
        alertType: 'kick',
        message: `🚫 ${username.trim()} was kicked and banned (exceeded ${formatMaxTime(maxDistractionSec)} distraction limit)`
      };
      if (!db.logs[currentRoomId]) db.logs[currentRoomId] = [];
      db.logs[currentRoomId].unshift(kickLog);

      // Broadcast to all room members
      io.to(currentRoomId).emit('user_kicked', { username: username.trim(), message: kickLog.message });
      io.to(currentRoomId).emit('room_update', {
        id: room.id,
        name: room.name,
        config: room.config,
        users: room.users.map(id => db.users[id]).filter(Boolean),
        logs: db.logs[currentRoomId]
      });

      return res.status(403).json({ kickedOut: true, banned: true, kickMessage });
    }

    // Check initial alert or recurring interval alert
    if (previousCategory !== 'distracting' || user.consecutiveDistractingSec <= deltaSec) {
      shouldTriggerAlert = true;
      alertType = 'initial';
      alertMessage = `Distracting tab detected! Stay focused on your goals.`;
      user.alertCountForDistraction = 1;
      console.log(`[Alert] 🚨 INITIAL alert for ${user.username} on ${url}`);
    } else {
      const nextThreshold = user.alertCountForDistraction * reminderInterval;
      if (user.consecutiveDistractingSec >= nextThreshold) {
        user.alertCountForDistraction += 1;
        shouldTriggerAlert = true;
        alertType = 'recurring';
        const mins = Math.floor(user.consecutiveDistractingSec / 60);
        const secs = user.consecutiveDistractingSec % 60;
        const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        alertMessage = `You have been on a distracting site for ${timeStr}! Time to get back to work!`;
        console.log(`[Alert] ⏰ RECURRING (${timeStr}) alert for ${user.username} on ${url}`);
      }
    }

    // ── 80% warning before kick ──
    if (maxDistractionSec && !shouldTriggerAlert) {
      const warningThreshold = maxDistractionSec * 0.8;
      if (user.distractingSec >= warningThreshold && (user.distractingSec - deltaSec) < warningThreshold) {
        shouldTriggerAlert = true;
        alertType = 'warning';
        const remainingSecs = Math.max(0, maxDistractionSec - user.distractingSec);
        alertMessage = `⚠️ Warning! You have used ${Math.round((user.distractingSec / maxDistractionSec) * 100)}% of your distraction allowance. Only ~${formatMaxTime(remainingSecs)} left before you are KICKED from the room!`;
        console.log(`[Alert] ⚠️ KICK WARNING for ${user.username}`);
      }
    }
  } else {
    // Untracked / Neutral URL
    user.untrackedSec += deltaSec;
    user.consecutiveDistractingSec = 0;
    user.alertCountForDistraction = 0;
  }

  // Create log entry on transitions or alerts
  if (previousCategory !== category || shouldTriggerAlert) {
    const logEntry = {
      id: 'log_' + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      username: user.username,
      url: url,
      category: category,
      alertType: shouldTriggerAlert ? alertType : null,
      message: shouldTriggerAlert ? alertMessage : `Switched to ${category} tab`
    };
    if (!db.logs[currentRoomId]) db.logs[currentRoomId] = [];
    db.logs[currentRoomId].unshift(logEntry);
    if (db.logs[currentRoomId].length > 40) db.logs[currentRoomId].pop();
  }

  // Broadcast update to room
  const roomData = {
    id: room.id,
    name: room.name,
    config: room.config,
    users: room.users.map(id => db.users[id]).filter(Boolean),
    logs: db.logs[currentRoomId]
  };
  io.to(currentRoomId).emit('room_update', roomData);

  if (shouldTriggerAlert) {
    io.to(currentRoomId).emit('distraction_alert', {
      username: user.username,
      url: url,
      alertType: alertType,
      message: alertMessage,
      consecutiveSec: user.consecutiveDistractingSec
    });
  }

  saveDb();

  res.json({
    success: true,
    user: {
      username: user.username,
      category: user.currentCategory,
      productiveSec: user.productiveSec,
      distractingSec: user.distractingSec,
      untrackedSec: user.untrackedSec,
      consecutiveDistractingSec: user.consecutiveDistractingSec,
      maxDistractionSec: maxDistractionSec
    },
    shouldAlert: shouldTriggerAlert,
    alertMessage: alertMessage,
    alertType: alertType,
    kickedOut: kickedOut,
    kickMessage: kickMessage
  });
});

// ─── SOCKET.IO ────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  socket.on('join_room', (data) => {
    const { roomId, roomPassword, username } = data;

    let room = findRoom(roomId) || findRoom(roomPassword);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    const currentRoomId = room.id;
    const usernameLower = (username || '').trim().toLowerCase();

    // Check if user is permanently banned
    if (room.bannedUsers && room.bannedUsers.includes(usernameLower)) {
      socket.emit('kicked_from_room', {
        permanent: true,
        username: username.trim(),
        message: 'You have been permanently removed from this room due to excessive distraction time. You cannot re-enter.'
      });
      return;
    }

    socket.join(currentRoomId);

    let userId = Object.keys(db.users).find(
      id => db.users[id].roomId === currentRoomId && db.users[id].username.toLowerCase() === usernameLower
    );

    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substr(2, 9);
      db.users[userId] = {
        id: userId,
        username: username.trim(),
        roomId: currentRoomId,
        productiveSec: 0,
        distractingSec: 0,
        untrackedSec: 0,
        isFocused: true,
        currentCategory: 'untracked',
        currentUrl: '',
        lastHeartbeat: Date.now(),
        consecutiveDistractingSec: 0,
        alertCountForDistraction: 0
      };
      if (!room.users.includes(userId)) {
        room.users.push(userId);
      }
    }

    socket.userId = userId;
    socket.roomId = currentRoomId;
    socket.username = username.trim();

    const roomData = {
      id: room.id,
      name: room.name,
      config: room.config,
      users: room.users.map(id => db.users[id]).filter(Boolean),
      logs: db.logs[currentRoomId] || []
    };
    io.to(currentRoomId).emit('room_update', roomData);
    socket.emit('config_update', room.config);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Gateway running on port ${PORT} with kick/ban distraction enforcement`);
});
