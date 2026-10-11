const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

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

// -- Database with local file persistence --
const DB_FILE = path.join(__dirname, 'db.json');
let db = {
  rooms: {},
  users: {},
  logs: {},
  history: {},
  accounts: {}, // email/username -> { passwordHash, email, username, createdAt }
  otps: {},    // email -> { code, expiresAt }
};

try {
  if (fs.existsSync(DB_FILE)) {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.rooms === 'object') {
      db.rooms = parsed.rooms || {};
      db.users = parsed.users || {};
      db.logs = parsed.logs || {};
      db.history = parsed.history || {};
      db.accounts = parsed.accounts || {};
      db.otps = {}; // never persist OTPs
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

// Helper: Ensure a user is only in ONE active room at a time by leaving any other active rooms
function leaveUserFromRooms(username, newRoomIdToKeep = null) {
  if (!username) return;
  const usernameLower = username.trim().toLowerCase();
  const now = Date.now();
  let leftAny = false;

  Object.values(db.rooms).forEach(room => {
    if (room.id !== newRoomIdToKeep && Array.isArray(room.users)) {
      const initialCount = room.users.length;
      room.users = room.users.filter(uid => {
        const u = db.users[uid];
        return !u || u.username.toLowerCase() !== usernameLower;
      });

      if (room.users.length !== initialCount) {
        leftAny = true;
        console.log(`[Room Leave] User "${username}" left room "${room.name}" (${room.id})`);

        // Record leftAt in user history
        if (db.history[usernameLower]) {
          db.history[usernameLower].forEach(h => {
            if (h.roomId === room.id && !h.leftAt) {
              h.leftAt = now;
            }
          });
        }

        // Broadcast updated room data to remaining members of old room
        const remainingSec = room.endsAt ? Math.max(0, Math.round((room.endsAt - now) / 1000)) : null;
        io.to(room.id).emit('room_update', {
          id: room.id,
          name: room.name,
          status: room.status || 'active',
          endsAt: room.endsAt,
          lifetimeSec: room.lifetimeSec,
          remainingSec: remainingSec,
          config: room.config,
          users: room.users.map(id => db.users[id]).filter(Boolean),
          logs: db.logs[room.id] || []
        });
      }
    }
  });

  if (leftAny) {
    saveDb();
    io.emit('rooms_list_update');
  }
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

// Helper: Compute Leaderboard for a room
// "the person who is has more productive time wins always"
function computeLeaderboard(room) {
  if (!room) return [];
  const roomUsers = (room.users || []).map(uId => db.users[uId]).filter(Boolean);

  // Sort primarily by productiveSec DESCENDING (more productive wins always)
  // Tie-breaker: distractingSec ASCENDING (fewer distractions is better)
  const sorted = [...roomUsers].sort((a, b) => {
    const prodDiff = (b.productiveSec || 0) - (a.productiveSec || 0);
    if (prodDiff !== 0) return prodDiff;
    return (a.distractingSec || 0) - (b.distractingSec || 0);
  });

  return sorted.map((u, idx) => {
    const prod = u.productiveSec || 0;
    const dist = u.distractingSec || 0;
    const untracked = u.untrackedSec || 0;
    const total = prod + dist;
    const ratio = total > 0 ? Math.round((prod / total) * 100) : 100;
    const rank = idx + 1;
    const isWinner = rank === 1 && prod > 0;

    return {
      rank,
      userId: u.id,
      username: u.username,
      productiveSec: prod,
      distractingSec: dist,
      untrackedSec: untracked,
      totalTrackedSec: prod + dist + untracked,
      productivityRatio: ratio,
      isWinner,
      badge: rank === 1 ? '🏆 Winner' : rank === 2 ? '🥈 Runner Up' : rank === 3 ? '🥉 3rd Place' : `#${rank}`
    };
  });
}

// Helper: Check if a room has expired/ended
function checkRoomExpiration(room) {
  if (!room) return;
  if (room.status === 'ended') return;

  if (room.endsAt && Date.now() >= room.endsAt) {
    room.status = 'ended';
    room.endedAt = Date.now();
    room.finalLeaderboard = computeLeaderboard(room);

    console.log(`[Room Ended] 🏁 Room "${room.name}" (${room.id}) has ended! Final winner:`, room.finalLeaderboard[0]?.username || 'None');

    const winnerName = room.finalLeaderboard[0]?.username;
    const winnerProd = room.finalLeaderboard[0]?.productiveSec || 0;
    const logEntry = {
      id: 'log_' + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      username: 'System',
      url: '',
      category: 'productive',
      alertType: 'session_ended',
      message: `🏁 Focus session completed! Winner: ${winnerName || 'None'} with ${formatMaxTime(winnerProd)} productive time.`
    };
    if (!db.logs[room.id]) db.logs[room.id] = [];
    db.logs[room.id].unshift(logEntry);

    saveDb();

    // Broadcast room ended and leaderboard
    io.to(room.id).emit('room_ended', {
      roomId: room.id,
      roomName: room.name,
      finalLeaderboard: room.finalLeaderboard
    });

    const roomData = {
      id: room.id,
      name: room.name,
      status: room.status,
      endsAt: room.endsAt,
      lifetimeSec: room.lifetimeSec,
      remainingSec: 0,
      config: room.config,
      users: room.users.map(id => db.users[id]).filter(Boolean),
      logs: db.logs[room.id] || [],
      finalLeaderboard: room.finalLeaderboard
    };
    io.to(room.id).emit('room_update', roomData);
    io.emit('rooms_list_update');
  }
}

// Background checker for room lifetime expiration
setInterval(() => {
  Object.values(db.rooms).forEach(checkRoomExpiration);
}, 2000);

// --- ROOMS API ----------------------------------------------------------------

// GET all rooms
app.get('/api/rooms', (req, res) => {
  const roomsList = Object.values(db.rooms).map(room => {
    checkRoomExpiration(room);
    const roomUsers = (room.users || []).map(uId => db.users[uId]).filter(Boolean);
    const totalProdSec = roomUsers.reduce((acc, u) => acc + (u.productiveSec || 0), 0);
    const totalDistSec = roomUsers.reduce((acc, u) => acc + (u.distractingSec || 0), 0);
    const remainingSec = room.endsAt ? Math.max(0, Math.round((room.endsAt - Date.now()) / 1000)) : null;

    return {
      id: room.id,
      name: room.name,
      creator: room.creator || (room.users[0] && db.users[room.users[0]]?.username) || null,
      userCount: roomUsers.length,
      status: room.status || 'active',
      lifetimeSec: room.lifetimeSec || null,
      endsAt: room.endsAt || null,
      remainingSec: remainingSec,
      finalLeaderboard: room.finalLeaderboard || (room.status === 'ended' ? computeLeaderboard(room) : null),
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
  const { name, password, config, creator, username } = req.body;
  const roomId = 'room_' + Math.random().toString(36).substr(2, 9);
  const roomPassword = (password && password.trim()) || Math.random().toString(36).substr(2, 6);
  const roomCreator = (creator || username || '').trim();

  const cleanProductive = Array.isArray(config?.productive)
    ? config.productive.map(p => (typeof p === 'string' ? p : p.url || '').trim()).filter(Boolean)
    : ['codeforces.com', 'github.com', 'leetcode.com', 'stackoverflow.com'];

  const cleanDistracting = Array.isArray(config?.distracting)
    ? config.distracting.map(d => (typeof d === 'string' ? d : d.url || '').trim()).filter(Boolean)
    : ['youtube.com', 'instagram.com', 'twitter.com', 'facebook.com', 'reddit.com', 'netflix.com'];

  const intervalSec = Number(config?.distractionIntervalSec) > 0 ? Number(config?.distractionIntervalSec) : 60;
  const maxDistractionSec = Number(config?.maxDistractionSec) > 0 ? Number(config?.maxDistractionSec) : null;
  const lifetimeSec = Number(config?.lifetimeSec) > 0 ? Number(config?.lifetimeSec) : null;
  const now = Date.now();
  const endsAt = lifetimeSec ? (now + lifetimeSec * 1000) : null;

  db.rooms[roomId] = {
    id: roomId,
    name: (name && name.trim()) || 'Focus Room',
    password: roomPassword,
    creator: roomCreator, // Room creator username
    users: [],
    bannedUsers: [], // lowercased usernames permanently banned from this room
    createdAt: new Date(),
    status: 'active', // 'active' | 'ended'
    lifetimeSec: lifetimeSec,
    endsAt: endsAt,
    finalLeaderboard: null,
    config: {
      productive: cleanProductive,
      distracting: cleanDistracting,
      distractionIntervalSec: intervalSec,
      maxDistractionSec: maxDistractionSec,
      lifetimeSec: lifetimeSec
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

  // If username provided, ensure user leaves any other room and is registered in this room
  if (username) {
    const usernameLower = username.trim().toLowerCase();
    leaveUserFromRooms(username, room.id);

    let userId = Object.keys(db.users).find(
      id => db.users[id].roomId === room.id && db.users[id].username.toLowerCase() === usernameLower
    );
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substr(2, 9);
      db.users[userId] = {
        id: userId,
        username: username.trim(),
        roomId: room.id,
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
    }
    if (!room.users.includes(userId)) {
      room.users.push(userId);
    }
    saveDb();

    // Emit live update
    io.to(room.id).emit('room_update', {
      id: room.id,
      name: room.name,
      creator: room.creator || (room.users[0] && db.users[room.users[0]]?.username) || null,
      status: room.status || 'active',
      endsAt: room.endsAt,
      lifetimeSec: room.lifetimeSec,
      config: room.config,
      users: room.users.map(id => db.users[id]).filter(Boolean),
      logs: db.logs[room.id] || []
    });
  }

  res.json({
    success: true,
    room: {
      id: room.id,
      name: room.name,
      creator: room.creator || (room.users[0] && db.users[room.users[0]]?.username) || null,
      config: room.config
    }
  });
});

// GET specific room data
app.get('/api/rooms/:id', (req, res) => {
  const room = db.rooms[req.params.id];
  if (!room) return res.status(404).json({ error: 'Room not found' });

  checkRoomExpiration(room);
  const remainingSec = room.endsAt ? Math.max(0, Math.round((room.endsAt - Date.now()) / 1000)) : null;

  const roomData = {
    id: room.id,
    name: room.name,
    creator: room.creator || (room.users[0] && db.users[room.users[0]]?.username) || null,
    status: room.status || 'active',
    lifetimeSec: room.lifetimeSec || null,
    endsAt: room.endsAt || null,
    remainingSec: remainingSec,
    config: room.config,
    users: room.users.map(userId => db.users[userId]).filter(Boolean),
    logs: db.logs[req.params.id] || [],
    finalLeaderboard: room.finalLeaderboard || (room.status === 'ended' ? computeLeaderboard(room) : null)
  };
  res.json(roomData);
});

// END focus room early & calculate final leaderboard
app.post('/api/rooms/:id/end', (req, res) => {
  const room = db.rooms[req.params.id];
  if (!room) return res.status(404).json({ error: 'Room not found' });

  room.status = 'ended';
  room.endedAt = Date.now();
  room.finalLeaderboard = computeLeaderboard(room);

  const winnerName = room.finalLeaderboard[0]?.username;
  const winnerProd = room.finalLeaderboard[0]?.productiveSec || 0;
  const logEntry = {
    id: 'log_' + Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toLocaleTimeString(),
    username: 'System',
    url: '',
    category: 'productive',
    alertType: 'session_ended',
    message: `🏁 Focus session completed! Winner: ${winnerName || 'None'} with ${formatMaxTime(winnerProd)} productive time.`
  };
  if (!db.logs[room.id]) db.logs[room.id] = [];
  db.logs[room.id].unshift(logEntry);

  saveDb();

  io.to(room.id).emit('room_ended', {
    roomId: room.id,
    roomName: room.name,
    finalLeaderboard: room.finalLeaderboard
  });

  const roomData = {
    id: room.id,
    name: room.name,
    status: room.status,
    endsAt: room.endsAt,
    lifetimeSec: room.lifetimeSec,
    remainingSec: 0,
    config: room.config,
    users: room.users.map(id => db.users[id]).filter(Boolean),
    logs: db.logs[room.id] || [],
    finalLeaderboard: room.finalLeaderboard
  };
  io.to(room.id).emit('room_update', roomData);
  io.emit('rooms_list_update');

  res.json({ success: true, finalLeaderboard: room.finalLeaderboard });
});

// UPDATE room settings (Creator only)
const updateRoomSettingsHandler = (req, res) => {
  const roomId = req.params.id;
  const room = db.rooms[roomId];
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const body = req.body || {};
  const requester = (body.username || body.requester || body.user || '').trim().toLowerCase();
  const roomCreator = (room.creator || (room.users[0] && db.users[room.users[0]]?.username) || '').trim().toLowerCase();
  const password = body.password ? String(body.password).trim() : '';

  // Verification: only creator can edit settings (or verified by room password)
  const isAuthorized = (roomCreator && requester === roomCreator) || (password && room.password === password);
  if (!isAuthorized) {
    return res.status(403).json({ error: 'Only the room creator can edit room settings.' });
  }

  // 1. Update room name if provided
  if (body.name && String(body.name).trim()) {
    room.name = String(body.name).trim();
  }

  // 2. Update config (support both nested body.config and flat body properties)
  const productiveList = body.productive !== undefined ? body.productive : body.config?.productive;
  const distractingList = body.distracting !== undefined ? body.distracting : body.config?.distracting;
  const alertInterval = body.distractionIntervalSec !== undefined ? body.distractionIntervalSec : body.config?.distractionIntervalSec;
  const maxDist = body.maxDistractionSec !== undefined ? body.maxDistractionSec : body.config?.maxDistractionSec;
  const lifetime = body.lifetimeSec !== undefined ? body.lifetimeSec : body.config?.lifetimeSec;

  if (Array.isArray(productiveList)) {
    room.config.productive = productiveList
      .map(p => (typeof p === 'string' ? p : p.url || '').trim())
      .filter(Boolean);
  }
  if (Array.isArray(distractingList)) {
    room.config.distracting = distractingList
      .map(d => (typeof d === 'string' ? d : d.url || '').trim())
      .filter(Boolean);
  }
  if (alertInterval !== undefined) {
    const intervalSec = Number(alertInterval);
    if (intervalSec > 0) room.config.distractionIntervalSec = intervalSec;
  }
  if (maxDist !== undefined) {
    const maxSec = Number(maxDist);
    room.config.maxDistractionSec = maxSec > 0 ? maxSec : null;
  }
  if (lifetime !== undefined) {
    const lifeSec = Number(lifetime);
    if (lifeSec > 0) {
      room.config.lifetimeSec = lifeSec;
      room.lifetimeSec = lifeSec;
      const baseTime = room.createdAt ? new Date(room.createdAt).getTime() : Date.now();
      room.endsAt = baseTime + lifeSec * 1000;
      if (room.status === 'ended' && room.endsAt > Date.now()) {
        room.status = 'active';
        room.finalLeaderboard = null;
      }
    } else {
      room.config.lifetimeSec = null;
      room.lifetimeSec = null;
      room.endsAt = null;
      if (room.status === 'ended') {
        room.status = 'active';
        room.finalLeaderboard = null;
      }
    }
  }

  saveDb();

  checkRoomExpiration(room);
  const remainingSec = room.endsAt ? Math.max(0, Math.round((room.endsAt - Date.now()) / 1000)) : null;
  const roomData = {
    id: room.id,
    name: room.name,
    creator: room.creator || (room.users[0] && db.users[room.users[0]]?.username) || null,
    status: room.status || 'active',
    lifetimeSec: room.lifetimeSec || null,
    endsAt: room.endsAt || null,
    remainingSec: remainingSec,
    config: room.config,
    users: room.users.map(userId => db.users[userId]).filter(Boolean),
    logs: db.logs[roomId] || [],
    finalLeaderboard: room.finalLeaderboard || (room.status === 'ended' ? computeLeaderboard(room) : null)
  };

  io.to(roomId).emit('room_update', roomData);
  io.to(roomId).emit('config_update', room.config);
  io.emit('rooms_list_update');

  console.log(`[Room Settings] Creator "${requester}" updated settings for room "${room.name}" (${room.id})`);
  res.json({ success: true, room: roomData });
};

app.put('/api/rooms/:id/settings', updateRoomSettingsHandler);
app.post('/api/rooms/:id/settings', updateRoomSettingsHandler);

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

// --- ACTIVITY & TIME TRACKING (from Chrome Extension Heartbeat) ---------------

app.post('/api/activity', (req, res) => {
  const { roomId, password, username, url, elapsedSec } = req.body;

  if (!username || !url) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const usernameLower = username.trim().toLowerCase();

  let room = findRoom(roomId) || findRoom(password);

  // Auto-resolve room if provided identifier is missing/stale/deleted
  if (!room) {
    // 1. Check if user is in an active room in db
    room = Object.values(db.rooms).find(r =>
      r.status !== 'ended' &&
      Array.isArray(r.users) &&
      r.users.some(uid => db.users[uid]?.username?.toLowerCase() === usernameLower)
    );
    // 2. Fallback: check most recent joined room in history
    if (!room && db.history[usernameLower]) {
      const lastEntry = db.history[usernameLower].slice(-1)[0];
      if (lastEntry && !lastEntry.leftAt && db.rooms[lastEntry.roomId] && db.rooms[lastEntry.roomId].status !== 'ended') {
        room = db.rooms[lastEntry.roomId];
      }
    }
    // 3. Fallback: if only one active room exists on the server
    if (!room) {
      const activeRooms = Object.values(db.rooms).filter(r => r.status !== 'ended');
      if (activeRooms.length === 1) {
        room = activeRooms[0];
      }
    }

    if (room) {
      console.log(`[Activity] Auto-resolved active room "${room.name}" (${room.id}) for user "${username}"`);
    }
  }

  if (!room) {
    console.warn(`[Activity] Room not found for identifier: "${roomId || password}" from user: "${username}"`);
    return res.status(404).json({ error: 'Room not found' });
  }

  const currentRoomId = room.id;

  // Check if room lifetime has expired
  checkRoomExpiration(room);
  if (room.status === 'ended') {
    return res.json({
      success: true,
      roomEnded: true,
      message: 'This focus room session has ended.',
      finalLeaderboard: room.finalLeaderboard || computeLeaderboard(room)
    });
  }

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


    // -- Check total distraction limit → KICK & BAN --
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

    // -- 80% warning before kick --
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
  const remainingSec = room.endsAt ? Math.max(0, Math.round((room.endsAt - Date.now()) / 1000)) : null;
  const roomData = {
    id: room.id,
    name: room.name,
    status: room.status || 'active',
    endsAt: room.endsAt || null,
    lifetimeSec: room.lifetimeSec || null,
    remainingSec: remainingSec,
    finalLeaderboard: room.finalLeaderboard || (room.status === 'ended' ? computeLeaderboard(room) : null),
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
    activeRoomId: room.id,
    roomName: room.name,
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

// --- SOCKET.IO ----------------------------------------------------------------

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

    // Enforce single-room policy: leave any existing rooms first!
    if (username) {
      leaveUserFromRooms(username, currentRoomId);
    }

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

    // ---- History tracking ----
    const uname = username.trim().toLowerCase();
    db.history[uname] = db.history[uname] || [];
    const historyEntry = { roomId: currentRoomId, joinedAt: Date.now(), leftAt: null };
    db.history[uname].push(historyEntry);
    socket.historyEntry = historyEntry;

    checkRoomExpiration(room);
    const remainingSec = room.endsAt ? Math.max(0, Math.round((room.endsAt - Date.now()) / 1000)) : null;
    const roomData = {
      id: room.id,
      name: room.name,
      creator: room.creator || (room.users[0] && db.users[room.users[0]]?.username) || null,
      status: room.status || 'active',
      endsAt: room.endsAt || null,
      lifetimeSec: room.lifetimeSec || null,
      remainingSec: remainingSec,
      finalLeaderboard: room.finalLeaderboard || (room.status === 'ended' ? computeLeaderboard(room) : null),
      config: room.config,
      users: room.users.map(id => db.users[id]).filter(Boolean),
      logs: db.logs[currentRoomId] || []
    };
    io.to(currentRoomId).emit('room_update', roomData);
    io.emit('rooms_list_update');
    socket.emit('config_update', room.config);
  });

  socket.on('leave_room', (data) => {
    const { username, roomId } = data || {};
    const uname = username || socket.username;
    if (uname) {
      leaveUserFromRooms(uname, null);
    }
    if (socket.roomId) {
      socket.leave(socket.roomId);
      socket.roomId = null;
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Update history leftAt if we have a stored entry
    if (socket.historyEntry) {
      socket.historyEntry.leftAt = Date.now();
      saveDb();
    }
    io.emit('rooms_list_update');
  });
});

// Explicit Leave Room Endpoint
app.post('/api/rooms/leave', (req, res) => {
  const { username, roomId } = req.body || {};
  if (username) {
    leaveUserFromRooms(username, null);
  }
  res.json({ success: true, message: 'Left room successfully' });
});

// GET user history
app.get('/api/history/:username', (req, res) => {
  const uname = (req.params.username || '').trim().toLowerCase();
  const hist = db.history[uname] || [];
  res.json({ username: uname, history: hist });
});

// GET user's current active room (for Chrome Extension auto-sync)
app.get('/api/users/:username/active-room', (req, res) => {
  const usernameLower = (req.params.username || '').trim().toLowerCase();
  let room = Object.values(db.rooms).find(r =>
    r.status !== 'ended' &&
    Array.isArray(r.users) &&
    r.users.some(uid => db.users[uid]?.username?.toLowerCase() === usernameLower)
  );

  if (!room && db.history[usernameLower]) {
    const lastEntry = db.history[usernameLower].slice(-1)[0];
    if (lastEntry && !lastEntry.leftAt && db.rooms[lastEntry.roomId] && db.rooms[lastEntry.roomId].status !== 'ended') {
      room = db.rooms[lastEntry.roomId];
    }
  }

  if (!room) {
    const activeRooms = Object.values(db.rooms).filter(r => r.status !== 'ended');
    if (activeRooms.length === 1) {
      room = activeRooms[0];
    }
  }

  if (room) {
    return res.json({
      success: true,
      roomId: room.id,
      roomName: room.name,
      roomPassword: room.password,
      config: room.config
    });
  }
  res.json({ success: false, roomId: null });
});

// -- Auth: Register --
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: 'Username, email and password are required.' });

  const emailKey = email.trim().toLowerCase();
  const userKey = username.trim().toLowerCase();

  // Check duplicates
  const accounts = Object.values(db.accounts);
  if (accounts.find(a => a.email === emailKey))
    return res.status(409).json({ error: 'An account with that email already exists.' });
  if (accounts.find(a => a.username.toLowerCase() === userKey))
    return res.status(409).json({ error: 'That username is already taken.' });

  const passwordHash = await bcrypt.hash(password, 10);
  const id = 'acc_' + crypto.randomBytes(6).toString('hex');
  db.accounts[id] = { id, username: username.trim(), email: emailKey, passwordHash, createdAt: Date.now() };
  saveDb();
  res.json({ ok: true, username: username.trim(), email: emailKey });
});

// -- Auth: Login --
app.post('/api/login', async (req, res) => {
  const { identifier, password } = req.body; // identifier = email or username
  if (!identifier || !password)
    return res.status(400).json({ error: 'Identifier and password are required.' });

  const key = identifier.trim().toLowerCase();
  const account = Object.values(db.accounts).find(
    a => a.email === key || a.username.toLowerCase() === key
  );
  if (!account)
    return res.status(401).json({ error: 'No account found with that email or username.' });

  const ok = await bcrypt.compare(password, account.passwordHash);
  if (!ok)
    return res.status(401).json({ error: 'Incorrect password.' });

  res.json({ ok: true, username: account.username, email: account.email });
});

// -- Auth: Forgot Password - send OTP --
app.post('/api/forgot', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  const emailKey = email.trim().toLowerCase();
  const account = Object.values(db.accounts).find(a => a.email === emailKey);
  if (!account)
    return res.status(404).json({ error: 'No account with that email.' });

  const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
  db.otps[emailKey] = { code, expiresAt: Date.now() + 10 * 60 * 1000 }; // 10 min

  // NOTE: Replace these Gmail credentials with real ones or use a service like Mailtrap for testing
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.MAIL_USER || 'your-email@gmail.com',
      pass: process.env.MAIL_PASS || 'your-app-password',
    },
  });

  try {
    await transporter.sendMail({
      from: `"Zero-Trust Focus" <${process.env.MAIL_USER || 'your-email@gmail.com'}>`,
      to: account.email,
      subject: 'Your Password Reset OTP',
      html: `<h2>Zero-Trust Focus - Password Reset</h2>
             <p>Your one-time code is: <strong style="font-size:2em;letter-spacing:4px">${code}</strong></p>
             <p>It expires in 10 minutes.</p>`,
    });
    res.json({ ok: true, message: 'OTP sent to your email.' });
  } catch (err) {
    console.error('[OTP] Failed to send email:', err.message);
    // Still respond with the code in dev mode so you can test without real email
    res.json({ ok: true, message: `[DEV] OTP is ${code} (email send failed - configure MAIL_USER/MAIL_PASS env vars)` });
  }
});

// -- Auth: Verify OTP + Reset Password --
app.post('/api/verify-otp', async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword)
    return res.status(400).json({ error: 'email, code and newPassword are required.' });

  const emailKey = email.trim().toLowerCase();
  const record = db.otps[emailKey];
  if (!record || record.code !== code)
    return res.status(400).json({ error: 'Invalid OTP.' });
  if (Date.now() > record.expiresAt)
    return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });

  const account = Object.values(db.accounts).find(a => a.email === emailKey);
  if (!account) return res.status(404).json({ error: 'Account not found.' });

  account.passwordHash = await bcrypt.hash(newPassword, 10);
  delete db.otps[emailKey];
  saveDb();
  res.json({ ok: true, message: 'Password reset successfully. You can now log in.' });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Gateway running on port ${PORT} with kick/ban distraction enforcement`);
});
