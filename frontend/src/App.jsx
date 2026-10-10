import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

const BACKEND = 'http://localhost:4000';
const socket = io(BACKEND);

// Helper: Format seconds into readable format (days, hrs, mins, secs)
function formatTime(totalSeconds = 0) {
  const secs = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(secs / 86400);
  const hrs = Math.floor((secs % 86400) / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  const remainingSecs = secs % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hrs > 0) parts.push(`${hrs}h`);
  if (mins > 0) parts.push(`${mins}m`);
  if (remainingSecs > 0 || parts.length === 0) parts.push(`${remainingSecs}s`);

  return parts.join(' ');
}


function formatClock(totalSeconds = 0) {
  const secs = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(secs / 60);
  const remainingSecs = secs % 60;
  return `${String(mins).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;
}

function App() {
  // Navigation views: 'hub' | 'create' | 'dashboard'
  const [view, setView] = useState('hub');

  // Rooms List state
  const [roomsList, setRoomsList] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  // Single Join Form state
  const [username, setUsername] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [showJoinPassword, setShowJoinPassword] = useState(false);
  const [joinError, setJoinError] = useState('');


  // Create Room state (Time-based configuration)
  const [createRoomName, setCreateRoomName] = useState('Sprint Focus Room');
  const [createPassword, setCreatePassword] = useState('');
  const [showCreatePassword, setShowCreatePassword] = useState(false);

  // Alert interval: days/hrs/mins/secs (default 1 min)
  const [alertD, setAlertD] = useState(0);
  const [alertH, setAlertH] = useState(0);
  const [alertM, setAlertM] = useState(1);
  const [alertS, setAlertS] = useState(0);

  // Max distraction kick limit: days/hrs/mins/secs (default 2 hrs)
  const [kickD, setKickD] = useState(0);
  const [kickH, setKickH] = useState(2);
  const [kickM, setKickM] = useState(0);
  const [kickS, setKickS] = useState(0);
  const [kickEnabled, setKickEnabled] = useState(true); // false = unlimited
  const [productiveRules, setProductiveRules] = useState([
    'codeforces.com',
    'github.com',
    'leetcode.com',
    'stackoverflow.com'
  ]);
  const [distractingRules, setDistractingRules] = useState([
    'youtube.com',
    'instagram.com',
    'twitter.com',
    'facebook.com',
    'netflix.com',
    'reddit.com'
  ]);

  // Tag inputs
  const [newProdUrl, setNewProdUrl] = useState('');
  const [newDistUrl, setNewDistUrl] = useState('');

  // Active Session state in dashboard
  const [currentRoom, setCurrentRoom] = useState(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [bannedFromRoom, setBannedFromRoom] = useState(null); // {message} if banned

  // Fetch all rooms from backend
  const fetchRooms = async () => {
    try {
      setLoadingRooms(true);
      const res = await fetch(`${BACKEND}/api/rooms`);
      if (res.ok) {
        const data = await res.json();
        setRoomsList(data);
      }
    } catch (err) {
      console.debug('Failed to fetch rooms:', err);
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    fetchRooms();

    socket.on('rooms_list_update', () => {
      fetchRooms();
    });

    socket.on('room_update', (data) => {
      setCurrentRoom(data);
    });

    socket.on('room_deleted', (data) => {
      if (currentRoom?.id === data.roomId) {
        alert('This room was deleted.');
        setView('hub');
        setCurrentRoom(null);
      }
      fetchRooms();
    });

    socket.on('distraction_alert', (data) => {
      const isRecurring = data.alertType === 'recurring';
      const isWarning = data.alertType === 'warning';
      setAlerts(prev => [
        ...prev,
        isWarning
          ? `⚠️ ${data.username}: ${data.message}`
          : isRecurring
          ? `⏰ ${data.username}: ${data.message}`
          : `🚨 ${data.username} opened distracting site: ${data.url}`
      ]);
      setTimeout(() => {
        setAlerts(prev => prev.slice(1));
      }, 6000);
    });

    // User was kicked out of the room (from API heartbeat)
    socket.on('user_kicked', (data) => {
      // Notify all room members about the kick
      setAlerts(prev => [...prev, `🚫 ${data.message}`]);
      setTimeout(() => {
        setAlerts(prev => prev.slice(1));
      }, 8000);
    });

    // Socket-based kick for the kicked user themselves
    socket.on('kicked_from_room', (data) => {
      setBannedFromRoom(data.message || 'You have been permanently removed from this room.');
      setView('banned');
    });

    return () => {
      socket.off('rooms_list_update');
      socket.off('room_update');
      socket.off('room_deleted');
      socket.off('distraction_alert');
      socket.off('user_kicked');
      socket.off('kicked_from_room');
    };
  }, [currentRoom]);

  // ── URL Rule Management ──
  const handleAddProductive = () => {
    const clean = newProdUrl.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!clean) return;
    if (productiveRules.includes(clean)) return;
    setProductiveRules(prev => [...prev, clean]);
    setNewProdUrl('');
  };

  const handleRemoveProductive = (index) => {
    setProductiveRules(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddDistracting = () => {
    const clean = newDistUrl.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!clean) return;
    if (distractingRules.includes(clean)) return;
    setDistractingRules(prev => [...prev, clean]);
    setNewDistUrl('');
  };

  const handleRemoveDistracting = (index) => {
    setDistractingRules(prev => prev.filter((_, i) => i !== index));
  };

  // ── Unified Join Action ──
  const handleJoin = async (targetRoomId, explicitPassword) => {
    setJoinError('');
    const roomToJoin = targetRoomId || selectedRoomId;
    const passToVerify = explicitPassword !== undefined ? explicitPassword : joinPassword;

    if (!username.trim()) {
      setJoinError('Please enter your Username.');
      return;
    }
    if (!roomToJoin && !passToVerify.trim()) {
      setJoinError('Please select a Room or enter the Room Password.');
      return;
    }
    if (!passToVerify.trim()) {
      setJoinError('Please enter the Room Password to join.');
      return;
    }

    try {
      const res = await fetch(`${BACKEND}/api/rooms/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: roomToJoin,
          password: passToVerify.trim(),
          username: username.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.banned) {
          setJoinError('🚫 You have been permanently removed from this room and cannot re-enter.');
          return;
        }
        setJoinError(data.error || 'Incorrect room password or room not found');
        return;
      }

      socket.emit('join_room', {
        roomId: data.room.id,
        roomPassword: passToVerify.trim(),
        username: username.trim()
      });

      setCurrentPassword(passToVerify.trim());
      setView('dashboard');
    } catch (err) {
      console.error('Join error:', err);
      setJoinError('Could not connect to server. Is backend running?');
    }
  };

  // ── Helper: D/H/M/S → total seconds ──
  const toSec = (d, h, m, s) =>
    (Number(d) || 0) * 86400 +
    (Number(h) || 0) * 3600 +
    (Number(m) || 0) * 60 +
    (Number(s) || 0);

  // ── Helper: total seconds → human label ──
  const secsToLabel = (total) => {
    if (!total || total <= 0) return '0s';
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const parts = [d && `${d}d`, h && `${h}h`, m && `${m}m`, s && `${s}s`].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : '0s';
  };

  // ── Create Room & Return to Hub ──
  const handleCreateRoom = async () => {
    const alertIntervalSec = Math.max(1, toSec(alertD, alertH, alertM, alertS));
    const maxDistSec = kickEnabled ? toSec(kickD, kickH, kickM, kickS) : null;

    try {
      const res = await fetch(`${BACKEND}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createRoomName.trim() || 'My Focus Room',
          password: createPassword.trim(),
          config: {
            productive: productiveRules,
            distracting: distractingRules,
            distractionIntervalSec: alertIntervalSec,
            maxDistractionSec: maxDistSec && maxDistSec > 0 ? maxDistSec : null
          }
        })
      });

      if (res.ok) {
        setSelectedRoomId('');
        setJoinPassword('');
        setCreatePassword('');
        setView('hub');
        fetchRooms();
      }
    } catch (err) {
      console.error('Failed to create room:', err);
      alert('Could not connect to backend server.');
    }
  };

  // ── Password Protected Delete Room ──
  const handleDeleteRoom = async (roomItem, e) => {
    e?.stopPropagation();
    const promptPass = window.prompt(`Enter the Password for room "${roomItem.name}" to delete it:`);
    if (promptPass === null) return;

    if (!promptPass.trim()) {
      alert('Room password is required to delete the room.');
      return;
    }

    try {
      const res = await fetch(`${BACKEND}/api/rooms/${roomItem.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: promptPass.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to delete room. Incorrect password.');
        return;
      }

      alert('Room deleted successfully!');
      fetchRooms();
      if (currentRoom?.id === roomItem.id && view === 'dashboard') {
        setView('hub');
        setCurrentRoom(null);
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Server communication error.');
    }
  };

  const handleCopyPassword = () => {
    if (!currentPassword) return;
    navigator.clipboard.writeText(currentPassword);
    setCopiedPass(true);
    setTimeout(() => setCopiedPass(false), 2000);
  };

  // Aggregate Calculations
  const roomUsers = currentRoom?.users || [];
  const totalTeamProdSec = roomUsers.reduce((sum, u) => sum + (u.productiveSec || 0), 0);
  const totalTeamDistSec = roomUsers.reduce((sum, u) => sum + (u.distractingSec || 0), 0);
  const totalTrackedSec = totalTeamProdSec + totalTeamDistSec;
  const teamRatio = totalTrackedSec > 0 ? Math.round((totalTeamProdSec / totalTrackedSec) * 100) : 100;

  // ═══════════════════════════════════════════════════════════════
  // BANNED / KICKED VIEW
  // ═══════════════════════════════════════════════════════════════
  if (view === 'banned') {
    return (
      <>
        <div className="app-bg">
          <div className="orb orb-1" />
          <div className="orb orb-2" />
          <div className="orb orb-3" />
        </div>
        <div className="app-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="banned-card">
            <div className="banned-icon">🚫</div>
            <h2 className="banned-title">Permanently Removed</h2>
            <p className="banned-message">{bannedFromRoom || 'You have been permanently removed from this room due to exceeding the maximum distraction time limit.'}</p>
            <p className="banned-hint">You cannot re-enter this room. Ask the room creator to set up a new room if you want to try again.</p>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setBannedFromRoom(null);
                setCurrentRoom(null);
                setView('hub');
              }}
            >
              ← Back to Hub
            </button>
          </div>
        </div>
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // VIEW 1: UNIFIED FOCUS HUB
  // ═══════════════════════════════════════════════════════════════
  if (view === 'hub') {
    return (
      <>
        <div className="app-bg">
          <div className="orb orb-1" />
          <div className="orb orb-2" />
          <div className="orb orb-3" />
        </div>
        <div className="app-content rooms-page">
          <div className="rooms-container">
            {/* Top Bar */}
            <div className="rooms-top-bar">
              <div className="rooms-brand">
                <div className="login-shield small-shield">🛡️</div>
                <div>
                  <h1 className="rooms-main-title">Zero-Trust Focus Hub</h1>
                  <p className="rooms-main-subtitle">Real-time time spent tracker on productive vs distracting tabs</p>
                </div>
              </div>
            </div>

            {/* Unified Single Join Section */}
            <div className="quick-join-card">
              <div className="join-section-title">
                <span className="section-indicator-dot" />
                <span>Join a Focus Room</span>
              </div>

              <div className="quick-join-inputs">
                <input
                  type="text"
                  placeholder="Your Username (e.g. Sahaj)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input-field"
                  autoComplete="off"
                  name="focus_username"
                />

                <select
                  className="input-field select-room-dropdown"
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                >
                  <option value="">-- Select Room Name --</option>
                  {roomsList.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.userCount} online)
                    </option>
                  ))}
                </select>

                <div className="password-input-wrap">
                  <input
                    type={showJoinPassword ? "text" : "password"}
                    placeholder="Room Password"
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                    className="input-field password-input-field"
                    autoComplete="new-password"
                    name="room_security_token"
                    onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                  />
                  <button
                    type="button"
                    className="password-eye-btn"
                    onMouseEnter={() => setShowJoinPassword(true)}
                    onMouseLeave={() => setShowJoinPassword(false)}
                    onClick={() => setShowJoinPassword(!showJoinPassword)}
                    title={showJoinPassword ? "Password visible" : "Hover or click to reveal password"}
                    aria-label="Toggle password visibility"
                  >
                    {showJoinPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    )}
                  </button>
                </div>

                <button
                  id="join-room-btn"
                  className="btn btn-primary"
                  onClick={() => handleJoin()}
                >
                  Join Room →
                </button>
              </div>

              {joinError && (
                <div className="join-error-msg">
                  ⚠️ {joinError}
                </div>
              )}
            </div>

            {/* Active Rooms Section */}
            <div className="rooms-list-header">
              <div className="section-title-wrap">
                <span className="section-indicator-dot" />
                <h2 className="rooms-section-heading">Available Focus Rooms ({roomsList.length})</h2>
              </div>
              <button
                className="btn btn-secondary btn-refresh"
                onClick={fetchRooms}
                title="Refresh rooms list"
              >
                🔄 Refresh
              </button>
            </div>

            {loadingRooms && roomsList.length === 0 && (
              <div className="rooms-loading">Loading rooms...</div>
            )}

            {roomsList.length === 0 && !loadingRooms && (
              <div className="rooms-empty-card">
                <div className="empty-icon">⏱️</div>
                <h3>No rooms active</h3>
                <p>Click the button below to create a room with custom productive and distracting websites.</p>
              </div>
            )}

            <div className="rooms-grid">
              {roomsList.map((r) => (
                <div key={r.id} className="room-item-card">
                  <div className="room-card-top">
                    <div>
                      <h3 className="room-name">{r.name}</h3>
                      <div className="room-privacy-tag">
                        🔒 Password Protected · Alert every {formatTime(r.distractionIntervalSec || 60)}
                        {r.maxDistractionSec ? ` · Kick limit: ${formatTime(r.maxDistractionSec)}` : ' · No kick limit'}
                      </div>
                    </div>
                    <button
                      className="room-delete-btn"
                      onClick={(e) => handleDeleteRoom(r, e)}
                      title="Delete room (Requires Password)"
                    >
                      🗑️
                    </button>
                  </div>

                  {/* Room Summary Overview */}
                  <div className="room-rules-overview">
                    <div className="rule-badge-row">
                      <span className="room-rule-pill pill-prod">
                        ✅ {r.productiveCount} Productive URLs
                      </span>
                      <span className="room-rule-pill pill-dist">
                        🚫 {r.distractingCount} Distracting URLs
                      </span>
                    </div>

                    <div className="rule-urls-preview">
                      {r.config?.productive?.slice(0, 3).map((p, i) => (
                        <span key={i} className="mini-url-tag tag-prod">
                          {typeof p === 'string' ? p : p.url}
                        </span>
                      ))}
                      {r.config?.distracting?.slice(0, 3).map((d, i) => (
                        <span key={i} className="mini-url-tag tag-dist">
                          {typeof d === 'string' ? d : d.url}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Card footer */}
                  <div className="room-card-footer">
                    <span className="room-user-count">
                      👥 {r.userCount} member{r.userCount === 1 ? '' : 's'}
                    </span>
                    <button
                      className="btn btn-primary btn-join-card"
                      onClick={() => {
                        setSelectedRoomId(r.id);
                        const enteredPass = window.prompt(`Enter Password for room "${r.name}":`);
                        if (enteredPass !== null && enteredPass.trim()) {
                          handleJoin(r.id, enteredPass.trim());
                        }
                      }}
                    >
                      Join Room →
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Static Create Room Button at Bottom */}
            <div className="bottom-create-room-bar">
              <button
                id="create-room-bottom-btn"
                className="btn btn-primary bottom-create-btn"
                onClick={() => setView('create')}
              >
                + Create New Room
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // VIEW 2: CONFIGURE ROOM & TIME RULES
  // ═══════════════════════════════════════════════════════════════
  if (view === 'create') {
    return (
      <>
        <div className="app-bg">
          <div className="orb orb-1" />
          <div className="orb orb-2" />
          <div className="orb orb-3" />
        </div>
        <div className="app-content setup-page">
          <div className="setup-card">
            <button className="btn-back" onClick={() => setView('hub')}>
              ← Back to Hub
            </button>

            <div className="login-header">
              <div className="login-shield">🛡️</div>
              <h1 className="login-title">Create Focus Room</h1>
              <p className="login-subtitle">Configure productive/distracting websites and recurring alert interval</p>
            </div>

            {/* Room Name, Password & Alert Interval */}
            <div className="create-room-fields">
              <div className="form-field-group">
                <label className="field-label">Room Name:</label>
                <input
                  className="input-field"
                  placeholder="e.g. Competitive Coding Sprint"
                  value={createRoomName}
                  onChange={(e) => setCreateRoomName(e.target.value)}
                />
              </div>

              <div className="form-field-group">
                <label className="field-label">Set Room Password:</label>
                <div className="password-input-wrap">
                  <input
                    type={showCreatePassword ? "text" : "password"}
                    className="input-field password-input-field"
                    placeholder="e.g. secret123 (or auto-generated)"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="password-eye-btn"
                    onMouseEnter={() => setShowCreatePassword(true)}
                    onMouseLeave={() => setShowCreatePassword(false)}
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                    title={showCreatePassword ? "Password visible" : "Hover or click to reveal password"}
                    aria-label="Toggle password visibility"
                  >
                    {showCreatePassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* ── Alert Interval: Days / Hours / Mins / Secs ── */}
              <div className="form-field-group">
                <div className="field-label-row">
                  <label className="field-label">🔔 Distraction Alert Interval:</label>
                  <span className="time-badge-preview">
                    ⏱️ Interval: <strong>{secsToLabel(toSec(alertD, alertH, alertM, alertS)) || '1m'}</strong>
                  </span>
                </div>
                <div className="time-picker-row">
                  <div className="time-picker-unit">
                    <input
                      type="number"
                      min="0"
                      max="365"
                      className="time-picker-input"
                      value={alertD}
                      onFocus={e => e.target.select()}
                      onChange={e => setAlertD(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    />
                    <span className="time-picker-label">days</span>
                  </div>
                  <div className="time-picker-sep">:</div>
                  <div className="time-picker-unit">
                    <input
                      type="number"
                      min="0"
                      max="23"
                      className="time-picker-input"
                      value={alertH}
                      onFocus={e => e.target.select()}
                      onChange={e => setAlertH(Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0)))}
                    />
                    <span className="time-picker-label">hrs</span>
                  </div>
                  <div className="time-picker-sep">:</div>
                  <div className="time-picker-unit">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      className="time-picker-input"
                      value={alertM}
                      onFocus={e => e.target.select()}
                      onChange={e => setAlertM(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                    />
                    <span className="time-picker-label">min</span>
                  </div>
                  <div className="time-picker-sep">:</div>
                  <div className="time-picker-unit">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      className="time-picker-input"
                      value={alertS}
                      onFocus={e => e.target.select()}
                      onChange={e => setAlertS(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                    />
                    <span className="time-picker-label">sec</span>
                  </div>
                  <div className="time-picker-preview alert-preview">
                    {secsToLabel(toSec(alertD, alertH, alertM, alertS)) || '0s'}
                  </div>
                </div>
                <div className="field-hint">Recurring reminder alert triggers every this duration while staying on a distracting site.</div>
              </div>

              {/* ── Max Distraction Kick Limit: Days / Hours / Mins / Secs ── */}
              <div className="form-field-group">
                <div className="field-label-row">
                  <label className="field-label">⚠️ Max Distraction Time (Kick Limit):</label>
                  {kickEnabled ? (
                    <span className="time-badge-preview kick-badge-active">
                      🚫 Kick at: <strong>{secsToLabel(toSec(kickD, kickH, kickM, kickS)) || '2h'}</strong>
                    </span>
                  ) : (
                    <span className="time-badge-preview kick-badge-off">
                      ♾️ Kick disabled (Unlimited)
                    </span>
                  )}
                </div>

                <div className="kick-toggle-row">
                  <label className="kick-toggle-label">
                    <input
                      type="checkbox"
                      className="kick-checkbox"
                      checked={kickEnabled}
                      onChange={e => setKickEnabled(e.target.checked)}
                    />
                    <span className="kick-toggle-text">Enable automatic kick & ban limit</span>
                  </label>
                </div>

                {kickEnabled && (
                  <div className="time-picker-row">
                    <div className="time-picker-unit">
                      <input
                        type="number"
                        min="0"
                        max="365"
                        className="time-picker-input"
                        value={kickD}
                        onFocus={e => e.target.select()}
                        onChange={e => setKickD(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      />
                      <span className="time-picker-label">days</span>
                    </div>
                    <div className="time-picker-sep">:</div>
                    <div className="time-picker-unit">
                      <input
                        type="number"
                        min="0"
                        max="23"
                        className="time-picker-input"
                        value={kickH}
                        onFocus={e => e.target.select()}
                        onChange={e => setKickH(Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0)))}
                      />
                      <span className="time-picker-label">hrs</span>
                    </div>
                    <div className="time-picker-sep">:</div>
                    <div className="time-picker-unit">
                      <input
                        type="number"
                        min="0"
                        max="59"
                        className="time-picker-input"
                        value={kickM}
                        onFocus={e => e.target.select()}
                        onChange={e => setKickM(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                      />
                      <span className="time-picker-label">min</span>
                    </div>
                    <div className="time-picker-sep">:</div>
                    <div className="time-picker-unit">
                      <input
                        type="number"
                        min="0"
                        max="59"
                        className="time-picker-input"
                        value={kickS}
                        onFocus={e => e.target.select()}
                        onChange={e => setKickS(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                      />
                      <span className="time-picker-label">sec</span>
                    </div>
                    <div className="time-picker-preview kick-preview">
                      {secsToLabel(toSec(kickD, kickH, kickM, kickS)) || '0s'}
                    </div>
                  </div>
                )}
                <div className="field-hint">
                  {kickEnabled
                    ? 'If a user accumulates more than this total distracting time, they are permanently removed & banned from the room.'
                    : 'No kick limit — members can stay in the room regardless of time spent on distracting sites.'}
                </div>
              </div>
            </div>

            {/* URL Rules Configuration (Clean Tags, No Points) */}
            <div className="config-columns">
              {/* Productive Column */}
              <div className="config-section productive-section">
                <div className="config-section-title">
                  <span className="config-dot productive-dot" />
                  <span>Productive Websites</span>
                  <span className="config-hint">Tracked as Focus Time</span>
                </div>

                <div className="url-list">
                  {productiveRules.map((url, idx) => (
                    <div key={idx} className="url-chip productive-chip">
                      <span className="url-chip-text">{url}</span>
                      <button
                        className="url-chip-remove"
                        onClick={() => handleRemoveProductive(idx)}
                        title="Remove website"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {productiveRules.length === 0 && (
                    <div className="strip-none">No productive websites added</div>
                  )}
                </div>

                <div className="url-add-row">
                  <input
                    className="input-field input-sm"
                    placeholder="e.g. codeforces.com"
                    value={newProdUrl}
                    onChange={(e) => setNewProdUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddProductive()}
                  />
                  <button
                    className="btn-add btn-add-productive"
                    onClick={handleAddProductive}
                    title="Add Website"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Distracting Column */}
              <div className="config-section distracting-section">
                <div className="config-section-title">
                  <span className="config-dot distracting-dot" />
                  <span>Distracting Websites</span>
                  <span className="config-hint">Triggers Alert Popups</span>
                </div>

                <div className="url-list">
                  {distractingRules.map((url, idx) => (
                    <div key={idx} className="url-chip distracting-chip">
                      <span className="url-chip-text">{url}</span>
                      <button
                        className="url-chip-remove"
                        onClick={() => handleRemoveDistracting(idx)}
                        title="Remove website"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {distractingRules.length === 0 && (
                    <div className="strip-none">No distracting websites added</div>
                  )}
                </div>

                <div className="url-add-row">
                  <input
                    className="input-field input-sm"
                    placeholder="e.g. youtube.com"
                    value={newDistUrl}
                    onChange={(e) => setNewDistUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddDistracting()}
                  />
                  <button
                    className="btn-add btn-add-distracting"
                    onClick={handleAddDistracting}
                    title="Add Website"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="config-note">
              ⏱️ <strong>How It Works:</strong> The system records exact time spent on productive vs distracting tabs. When opening a distracting tab, an alert fires immediately, followed by a reminder every <strong>{secsToLabel(toSec(alertD, alertH, alertM, alertS)) || '1m'}</strong> if you stay distracted.
            </div>

            <div className="action-buttons-row">
              <button
                id="create-room-submit-btn"
                className="btn btn-primary"
                onClick={handleCreateRoom}
              >
                Create Room & Return to Hub →
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setView('hub')}
              >
                Cancel / Return to Hub
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // VIEW 3: LIVE TIME-TRACKING DASHBOARD
  // ═══════════════════════════════════════════════════════════════
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
              <button
                className="btn btn-secondary"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', marginRight: '0.5rem' }}
                onClick={() => setView('hub')}
              >
                ← Exit to Hub
              </button>
              <div className="dash-shield">⏱️</div>
              <div className="dash-title-group">
                <h1 className="dash-title">{currentRoom?.name || 'Live Focus Dashboard'}</h1>
                <div className="dash-room-pass">
                  <span>Room Password:</span>
                  <code>{showPassword ? currentPassword : '••••••••'}</code>
                  <button
                    className="pass-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide Password' : 'Show Password'}
                  >
                    {showPassword ? '👁️' : '🔒'}
                  </button>
                  <button
                    className="copy-btn small"
                    onClick={handleCopyPassword}
                    title="Copy Room Password"
                  >
                    {copiedPass ? '✅ Copied' : '📋 Copy'}
                  </button>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <div className="dash-user-badge">
                <span className="status-dot" />
                {username}
              </div>
            </div>
          </div>
        </header>

        {/* Real-time Toast Alerts */}
        <div className="alerts-container">
          {alerts.map((alert, i) => (
            <div key={i} className="alert-toast">
              <span className="alert-icon">⚠️</span>
              {alert}
            </div>
          ))}
        </div>

        {/* Dashboard Body */}
        <main className="dash-body">
          {/* Overall Room Aggregate Time Metrics */}
          <div className="overall-stats-grid">
            <div className="stat-card prod-stat">
              <div className="stat-card-label">✅ Total Team Productive Time</div>
              <div className="stat-card-value text-green">{formatTime(totalTeamProdSec)}</div>
              <div className="stat-card-sub">{roomUsers.length} member{roomUsers.length === 1 ? '' : 's'} tracked</div>
            </div>

            <div className="stat-card dist-stat">
              <div className="stat-card-label">🚫 Total Team Distracting Time</div>
              <div className="stat-card-value text-red">{formatTime(totalTeamDistSec)}</div>
              <div className="stat-card-sub">
                Alert every {formatTime(currentRoom?.config?.distractionIntervalSec || 60)}
                {currentRoom?.config?.maxDistractionSec
                  ? ` · Kick limit: ${formatTime(currentRoom.config.maxDistractionSec)}`
                  : ' · No kick limit'}
              </div>
            </div>

            <div className="stat-card ratio-stat">
              <div className="stat-card-label">📈 Focus Productivity Ratio</div>
              <div className="stat-card-value text-cyan">{teamRatio}%</div>
              <div className="stat-card-sub">Productive / Total Tracked Time</div>
            </div>
          </div>

          {/* Active Config Rules Ribbon */}
          {currentRoom?.config && (
            <div className="config-summary-strip">
              <div className="config-strip-section">
                <span className="strip-label productive-label">✅ Productive Sites:</span>
                {currentRoom.config.productive?.map((site, i) => (
                  <span key={i} className="strip-chip productive-chip-sm">
                    {typeof site === 'string' ? site : site.url}
                  </span>
                ))}
              </div>
              <div className="config-strip-section">
                <span className="strip-label distracting-label">🚫 Distracting Sites:</span>
                {currentRoom.config.distracting?.map((site, i) => (
                  <span key={i} className="strip-chip distracting-chip-sm">
                    {typeof site === 'string' ? site : site.url}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Team Members Grid with Individual Time Clocks */}
          <div className="dash-section-label">Active Team Members & Individual Times</div>
          <div className="users-grid">
            {roomUsers.map((user, index) => {
              const userProdSec = user.productiveSec || 0;
              const userDistSec = user.distractingSec || 0;
              const userUntrackedSec = user.untrackedSec || 0;
              const userTotalSec = userProdSec + userDistSec;
              const userRatio = userTotalSec > 0 ? Math.round((userProdSec / userTotalSec) * 100) : 100;
              const isDistracted = user.currentCategory === 'distracting';
              const isProductive = user.currentCategory === 'productive';

              return (
                <div
                  key={user.id}
                  className={`user-card ${isDistracted ? 'distracted' : isProductive ? 'focused' : ''}`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="card-header">
                    <div>
                      <h3 className="card-username">{user.username}</h3>
                      {user.currentUrl && (
                        <div className="card-last-url" title={user.currentUrl}>
                          🌐 {user.currentUrl.length > 32 ? user.currentUrl.substring(0, 32) + '...' : user.currentUrl}
                        </div>
                      )}
                    </div>
                    <span className={`card-status-badge ${isDistracted ? 'distracted' : isProductive ? 'focused' : 'untracked'}`}>
                      {isDistracted
                        ? `● Distracted (${user.consecutiveDistractingSec || 0}s)`
                        : isProductive
                        ? '● Productive'
                        : '● Untracked (Neutral)'}
                    </span>
                  </div>

                  {/* Individual Time Cards (3 columns) */}
                  <div className="individual-time-grid individual-time-grid-3">
                    <div className="time-pill-box prod-box">
                      <span className="time-pill-label">Productive</span>
                      <span className="time-pill-val prod-val">{formatTime(userProdSec)}</span>
                    </div>
                    <div className="time-pill-box dist-box">
                      <span className="time-pill-label">Distracting</span>
                      <span className="time-pill-val dist-val">{formatTime(userDistSec)}</span>
                    </div>
                    <div className="time-pill-box neutral-box">
                      <span className="time-pill-label">Neutral / Other</span>
                      <span className="time-pill-val neutral-val">{formatTime(userUntrackedSec)}</span>
                    </div>
                  </div>


                  {/* Kick limit bar: only show if maxDistractionSec is configured */}
                  {currentRoom?.config?.maxDistractionSec > 0 && (() => {
                    const maxSec = currentRoom.config.maxDistractionSec;
                    const usedPct = Math.min(100, Math.round((userDistSec / maxSec) * 100));
                    const dangerLevel = usedPct >= 80 ? 'danger' : usedPct >= 50 ? 'warn' : 'safe';
                    return (
                      <div className="kick-limit-bar-wrap" style={{ marginTop: '0.6rem' }}>
                        <div className="kick-limit-bar-header">
                          <span className="kick-limit-label">
                            ⚠️ Kick Limit: {formatTime(userDistSec)} / {formatTime(maxSec)}
                          </span>
                          <span className={`kick-pct kick-pct-${dangerLevel}`}>{usedPct}%</span>
                        </div>
                        <div className="kick-limit-track">
                          <div
                            className={`kick-limit-fill kick-fill-${dangerLevel}`}
                            style={{ width: `${usedPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Time Ratio Split Bar */}
                  <div className="card-score-section" style={{ marginTop: '0.75rem' }}>
                    <div className="card-score-header">
                      <span className="card-score-label">Focus Efficiency</span>
                      <span className="card-score-value high" style={{ fontSize: '1rem' }}>
                        {userRatio}%
                      </span>
                    </div>
                    <div className="score-bar-track">
                      <div
                        className="score-bar-fill high"
                        style={{ width: `${userRatio}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty State */}
          {(!currentRoom || !currentRoom.users || currentRoom.users.length === 0) && (
            <div className="empty-state">
              <div className="radar-container">
                <div className="radar-ring radar-ring-1" />
                <div className="radar-ring radar-ring-2" />
                <div className="radar-ring radar-ring-3" />
                <div className="radar-sweep" />
                <div className="radar-center-dot" />
              </div>
              <p className="empty-state-text">Waiting for Chrome Extension sync...</p>
              <p className="empty-state-subtext">
                Connect the Chrome Extension with your Username <strong>{username}</strong> and Room Password <strong>{currentPassword}</strong>
              </p>
            </div>
          )}

          {/* Individual Detailed Times Table Panel */}
          {roomUsers.length > 0 && (
            <div className="detailed-breakdown-card">
              <div className="dash-section-label" style={{ marginBottom: '1rem' }}>
                Individual Time Breakdown Table
              </div>
              <div className="breakdown-table-wrapper">
                <table className="breakdown-table">
                  <thead>
                    <tr>
                      <th>Team Member</th>
                      <th>Current Site</th>
                      <th>Productive Time</th>
                      <th>Distracting Time</th>
                      <th>Untracked Time</th>
                      <th>Focus Ratio</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roomUsers.map((u) => {
                      const prod = u.productiveSec || 0;
                      const dist = u.distractingSec || 0;
                      const untracked = u.untrackedSec || 0;
                      const total = prod + dist;
                      const ratio = total > 0 ? Math.round((prod / total) * 100) : 100;
                      const isDist = u.currentCategory === 'distracting';

                      return (
                        <tr key={u.id}>
                          <td className="table-username"><strong>{u.username}</strong></td>
                          <td className="table-url" title={u.currentUrl || 'Idle'}>
                            {u.currentUrl ? (u.currentUrl.length > 28 ? u.currentUrl.substring(0, 28) + '...' : u.currentUrl) : 'Idle'}
                          </td>
                          <td className="text-green table-mono">{formatTime(prod)}</td>
                          <td className="text-red table-mono">{formatTime(dist)}</td>
                          <td className="table-mono" style={{ opacity: 0.6 }}>{formatTime(untracked)}</td>
                          <td>
                            <span className="ratio-tag">{ratio}%</span>
                          </td>
                          <td>
                            <span className={`card-status-badge ${isDist ? 'distracted' : 'focused'}`}>
                              {isDist ? 'Distracted' : 'Focused'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Live Activity Log */}
          {currentRoom?.logs && currentRoom.logs.length > 0 && (
            <div className="activity-logs-section">
              <div className="dash-section-label" style={{ marginTop: '2.5rem' }}>
                Live Tab Activity & Alert History
              </div>
              <div className="logs-list">
                {currentRoom.logs.map((log) => (
                  <div key={log.id} className={`log-item log-${log.category}`}>
                    <span className="log-time">{log.timestamp}</span>
                    <span className="log-user">{log.username}</span>
                    <span className="log-url" title={log.url}>{log.url}</span>
                    <span className={`log-points-badge badge-${log.category}`}>
                      {log.category === 'productive' && `✅ Productive`}
                      {log.category === 'distracting' && `🚨 Distracting`}
                      {log.category === 'untracked' && `⚪ Neutral`}
                    </span>
                    <span className="log-msg" style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

export default App;
