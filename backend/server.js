const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// In-Memory Database (No SQLite/Prisma required for fast local running!)
const db = {
  rooms: {},
  users: {},
  logs: []
};

// API Endpoints
app.post('/api/rooms', (req, res) => {
  const { name } = req.body;
  const roomId = 'room_' + Math.random().toString(36).substr(2, 9);
  
  db.rooms[roomId] = {
    id: roomId,
    name: name || 'Focus Room',
    users: [],
    createdAt: new Date()
  };
  
  res.json(db.rooms[roomId]);
});

app.get('/api/rooms/:id', (req, res) => {
  const room = db.rooms[req.params.id];
  if (!room) return res.status(404).json({ error: 'Room not found' });
  
  // Format for frontend
  const roomData = {
    ...room,
    users: room.users.map(userId => db.users[userId])
  };
  res.json(roomData);
});

// Real-time API Endpoint from Chrome Extension
app.post('/api/activity', (req, res) => {
  const { roomId, username, url, isProductive } = req.body;
  
  let userId = Object.keys(db.users).find(id => db.users[id].roomId === roomId && db.users[id].username === username);
  
  if (!userId) {
    userId = 'user_' + Math.random().toString(36).substr(2, 9);
    db.users[userId] = { id: userId, username, roomId, score: 100, isFocused: true };
    if (db.rooms[roomId]) db.rooms[roomId].users.push(userId);
  }

  let user = db.users[userId];
  
  // Update score based on productivity
  if (isProductive) {
    user.score = Math.min(100, user.score + 1);
  } else {
    user.score = Math.max(0, user.score - 5);
  }
  user.isFocused = isProductive;

  // Broadcast update to room
  if (db.rooms[roomId]) {
    const roomData = { ...db.rooms[roomId], users: db.rooms[roomId].users.map(id => db.users[id]) };
    io.to(roomId).emit('room_update', roomData);
    
    if (!isProductive) {
      io.to(roomId).emit('distraction_alert', { username: user.username });
    }
  }

  res.json({ success: true, score: user.score });
});

// Socket.io Real-time Gateway
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_room', (data) => {
    const { roomId, username } = data;
    socket.join(roomId);
    
    // Create or find user
    let userId = Object.keys(db.users).find(id => db.users[id].roomId === roomId && db.users[id].username === username);
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substr(2, 9);
      db.users[userId] = { id: userId, username, roomId, score: 100, isFocused: true };
      if (!db.rooms[roomId]) {
        db.rooms[roomId] = { id: roomId, name: 'Focus Room', users: [] };
      }
      db.rooms[roomId].users.push(userId);
    }

    socket.userId = userId;
    socket.roomId = roomId;

    const roomData = { ...db.rooms[roomId], users: db.rooms[roomId].users.map(id => db.users[id]) };
    io.to(roomId).emit('room_update', roomData);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Gateway running on port ${PORT} with in-memory fast database`);
});
