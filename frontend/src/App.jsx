import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

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

  const getScoreLevel = (score) => {
    if (score > 80) return 'high';
    if (score > 50) return 'medium';
    return 'low';
  };

  // ─── Login Screen ───
  if (!joined) {
    return (
      <>
        <div className="app-bg">
          <div className="orb orb-1" />
          <div className="orb orb-2" />
          <div className="orb orb-3" />
        </div>
        <div className="app-content login-page">
          <div className="login-card">
            <div className="login-header">
              <div className="login-shield">🛡️</div>
              <h1 className="login-title">Zero-Trust Focus</h1>
              <p className="login-subtitle">Real-time Productivity Monitor</p>
            </div>

            <div className="form-group">
              <input
                id="username-input"
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field"
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              />

              <div className="input-row">
                <input
                  id="room-id-input"
                  type="text"
                  placeholder="Room ID"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="input-field"
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                />
                <button
                  id="create-room-btn"
                  onClick={createRoom}
                  className="btn btn-secondary"
                >
                  New
                </button>
              </div>

              <button
                id="join-session-btn"
                onClick={handleJoin}
                className="btn btn-primary"
              >
                Join Session
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ─── Dashboard ───
  return (
    <>
      <div className="app-bg">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
      </div>
      <div className="app-content dashboard">
        {/* Header */}
        <header className="dash-header">
          <div className="dash-header-inner">
            <div className="dash-brand">
              <div className="dash-shield">🛡️</div>
              <div className="dash-title-group">
                <h1 className="dash-title">Live Focus Dashboard</h1>
                <div className="dash-room-id">
                  Room <code>{roomId}</code>
                </div>
              </div>
            </div>
            <div className="dash-user-badge">
              <span className="status-dot" />
              {username}
            </div>
          </div>
        </header>

        {/* Alerts */}
        <div className="alerts-container">
          {alerts.map((alert, i) => (
            <div key={i} className="alert-toast">
              <span className="alert-icon">⚠️</span>
              {alert}
            </div>
          ))}
        </div>

        {/* Body */}
        <main className="dash-body">
          <div className="dash-section-label">Team Members</div>
          <div className="users-grid">
            {roomData?.users?.map((user, index) => (
              <div
                key={user.id}
                className={`user-card ${user.isFocused ? 'focused' : 'distracted'}`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="card-header">
                  <h3 className="card-username">{user.username}</h3>
                  <span className={`card-status-badge ${user.isFocused ? 'focused' : 'distracted'}`}>
                    {user.isFocused ? '● Focused' : '● Distracted'}
                  </span>
                </div>
                <div className="card-score-section">
                  <div className="card-score-header">
                    <span className="card-score-label">Productivity Score</span>
                    <span className={`card-score-value ${getScoreLevel(user.score)}`}>
                      {user.score}
                    </span>
                  </div>
                  <div className="score-bar-track">
                    <div
                      className={`score-bar-fill ${getScoreLevel(user.score)}`}
                      style={{ width: `${user.score}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {(!roomData || !roomData.users || roomData.users.length === 0) && (
            <div className="empty-state">
              <div className="radar-container">
                <div className="radar-ring radar-ring-1" />
                <div className="radar-ring radar-ring-2" />
                <div className="radar-ring radar-ring-3" />
                <div className="radar-sweep" />
                <div className="radar-center-dot" />
              </div>
              <p className="empty-state-text">Scanning for team members…</p>
              <p className="empty-state-subtext">Share the Room ID to get started</p>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

export default App;
