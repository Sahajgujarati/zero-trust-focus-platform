import { useState, useEffect } from 'react';
import io from 'socket.io-client';

const socket = io('https://zero-trust-focus-platform-1.onrender.com');

function App() {
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [joined, setJoined] = useState(false);
  const [roomData, setRoomData] = useState(null);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    socket.on('room_update', (data) => {
      setRoomData(data);
    });

    socket.on('distraction_alert', (data) => {
      setAlerts(prev => [...prev, `${data.username} got distracted!`]);
      setTimeout(() => {
        setAlerts(prev => prev.slice(1));
      }, 5000);
    });

    return () => {
      socket.off('room_update');
      socket.off('distraction_alert');
    };
  }, []);

  const handleJoin = () => {
    if (!roomId || !username) return;
    socket.emit('join_room', { roomId, username });
    setJoined(true);
  };

  const createRoom = async () => {
    const res = await fetch('https://zero-trust-focus-platform-1.onrender.com/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'My Focus Room' })
    });
    const data = await res.json();
    setRoomId(data.id);
  };

  if (!joined) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white font-sans p-4">
        <div className="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-md w-full border border-gray-700">
          <h1 className="text-3xl font-bold mb-6 text-center text-blue-400">Zero-Trust Focus</h1>
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="Username" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
            />
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Room ID" 
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
              />
              <button 
                onClick={createRoom}
                className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap"
              >
                New
              </button>
            </div>
            <button 
              onClick={handleJoin}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-all transform hover:scale-[1.02]"
            >
              Join Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-blue-400">Live Focus Dashboard</h1>
            <p className="text-gray-400 mt-1">Room ID: <span className="font-mono text-gray-300 bg-gray-800 px-2 py-1 rounded">{roomId}</span></p>
          </div>
          <div className="text-xl font-medium bg-gray-800 px-4 py-2 rounded-lg border border-gray-700">
            {username}
          </div>
        </div>

        {/* Alerts */}
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {alerts.map((alert, i) => (
            <div key={i} className="bg-red-500/90 text-white px-6 py-3 rounded-lg shadow-lg animate-bounce border border-red-400 font-medium">
              ⚠️ {alert}
            </div>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {roomData?.users?.map(user => (
            <div key={user.id} className={`bg-gray-800 rounded-xl p-6 shadow-lg border-2 transition-all ${user.isFocused ? 'border-green-500/50 hover:border-green-400' : 'border-red-500/80 animate-pulse'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">{user.username}</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${user.isFocused ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {user.isFocused ? 'FOCUSED' : 'DISTRACTED'}
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-400">
                  <span>Productivity Score</span>
                  <span className="font-bold text-white">{user.score}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                  <div className={`h-2.5 rounded-full transition-all duration-500 ${user.score > 80 ? 'bg-green-500' : user.score > 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${user.score}%` }}></div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {(!roomData || !roomData.users || roomData.users.length === 0) && (
          <div className="text-center py-20 text-gray-500">
            Waiting for users to join...
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
