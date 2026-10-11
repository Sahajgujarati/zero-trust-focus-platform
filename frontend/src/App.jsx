import { useState, useEffect, useRef } from 'react';
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
  // Navigation views: 'login' | 'hub' | 'create' | 'dashboard' | 'history'
  const [view, setView] = useState('login');

  // -- Auth state --
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register' | 'forgot' | 'otp'
  const [authIdentifier, setAuthIdentifier] = useState(''); // email or username for login
  const [authEmail, setAuthEmail] = useState('');     // email for register / forgot
  const [authRegUsername, setAuthRegUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authOtp, setAuthOtp] = useState('');
  const [authNewPassword, setAuthNewPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authSuccess, setAuthSuccess] = useState('');
  const [loggedInEmail, setLoggedInEmail] = useState(''); // store email after login for OTP flow

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

  // Room lifetime duration: days/hrs/mins/secs (default 10 hrs)
  const [lifeD, setLifeD] = useState(0);
  const [lifeH, setLifeH] = useState(10);
  const [lifeM, setLifeM] = useState(0);
  const [lifeS, setLifeS] = useState(0);
  const [lifeEnabled, setLifeEnabled] = useState(true);

  // Leaderboard & countdown states
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [activeLeaderboard, setActiveLeaderboard] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);

  // Max distraction kick limit: days/hrs/mins/secs (default 2 hrs)
  const [kickD, setKickD] = useState(0);
  const [kickH, setKickH] = useState(2);
  const [kickM, setKickM] = useState(0);
  const [kickS, setKickS] = useState(0);
  const [kickEnabled, setKickEnabled] = useState(true); // false = unlimited
// History view state
const [historyData, setHistoryData] = useState([]);
const [loadingHistory, setLoadingHistory] = useState(false);

  // Room settings modal state (Room Creator only)
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editRoomName, setEditRoomName] = useState('');
  const [editProdRules, setEditProdRules] = useState([]);
  const [editDistRules, setEditDistRules] = useState([]);
  const [newEditProdUrl, setNewEditProdUrl] = useState('');
  const [newEditDistUrl, setNewEditDistUrl] = useState('');
  const [editAlertD, setEditAlertD] = useState(0);
  const [editAlertH, setEditAlertH] = useState(0);
  const [editAlertM, setEditAlertM] = useState(1);
  const [editAlertS, setEditAlertS] = useState(0);
  const [editKickEnabled, setEditKickEnabled] = useState(true);
  const [editKickD, setEditKickD] = useState(0);
  const [editKickH, setEditKickH] = useState(2);
  const [editKickM, setEditKickM] = useState(0);
  const [editKickS, setEditKickS] = useState(0);
  const [editLifeEnabled, setEditLifeEnabled] = useState(true);
  const [editLifeD, setEditLifeD] = useState(0);
  const [editLifeH, setEditLifeH] = useState(10);
  const [editLifeM, setEditLifeM] = useState(0);
  const [editLifeS, setEditLifeS] = useState(0);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');

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
  const currentRoomRef = useRef(null);
  useEffect(() => {
  currentRoomRef.current = currentRoom;
}, [currentRoom]);

// Fetch history when view switches to 'history'
useEffect(() => {
  if (view === 'history' && username) {
    setLoadingHistory(true);
    fetch(`${BACKEND}/api/history/${username.trim()}`)
      .then(res => res.json())
      .then(data => {
        setHistoryData(data.history || []);
        setLoadingHistory(false);
      })
      .catch(err => {
        console.debug('Failed to fetch history:', err);
        setLoadingHistory(false);
      });
  }
}, [view, username]);

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

  // Cleanly leave current active focus room
  const handleLeaveRoom = async () => {
    if (username && currentRoomRef.current?.id) {
      const activeId = currentRoomRef.current.id;
      socket.emit('leave_room', { roomId: activeId, username });
      try {
        await fetch(`${BACKEND}/api/rooms/leave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, roomId: activeId })
        });
      } catch (e) {}
    }
    localStorage.removeItem('focus_session');
    setCurrentRoom(null);
    setView('hub');
    fetchRooms();
  };

  // -- Unified Join Action (with Instant Room Hydration & localStorage Persistence) --
  const handleJoin = async (targetRoomId, explicitPassword, explicitUsername) => {
    setJoinError('');
    const roomToJoin = targetRoomId || selectedRoomId;
    const passToVerify = explicitPassword !== undefined ? explicitPassword : joinPassword;
    let userToVerify = (explicitUsername || username || '').trim();

    if (!userToVerify) {
      userToVerify = window.prompt('Please enter your Username to enter the room:') || '';
      userToVerify = userToVerify.trim();
      if (!userToVerify) {
        setJoinError('Please enter your Username.');
        return;
      }
      setUsername(userToVerify);
    }
    if (!roomToJoin && !passToVerify.trim()) {
      setJoinError('Please select a Room or enter the Room Password.');
      return;
    }

    // Enforce single-room policy: leave any currently active room before joining another!
    if (currentRoomRef.current && currentRoomRef.current.id !== roomToJoin) {
      socket.emit('leave_room', { roomId: currentRoomRef.current.id, username: userToVerify });
      try {
        await fetch(`${BACKEND}/api/rooms/leave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: userToVerify, roomId: currentRoomRef.current.id })
        });
      } catch (e) {}
    }

    try {
      const res = await fetch(`${BACKEND}/api/rooms/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: roomToJoin,
          password: passToVerify.trim(),
          username: userToVerify
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.banned) {
          setJoinError('You have been permanently removed from this room and cannot re-enter.');
          return;
        }
        setJoinError(data.error || 'Incorrect room password or room not found');
        return;
      }

      const activeRoomId = data.room?.id || roomToJoin;

      // 1. Instantly fetch and populate full room data so all running timers display immediately
      try {
        const roomRes = await fetch(`${BACKEND}/api/rooms/${activeRoomId}`);
        if (roomRes.ok) {
          const fullRoom = await roomRes.json();
          setCurrentRoom(fullRoom);
        }
      } catch (e) {
        console.debug('Failed to load full room data:', e);
      }

      // 2. Emit socket join event
      socket.emit('join_room', {
        roomId: activeRoomId,
        roomPassword: passToVerify.trim(),
        username: userToVerify
      });

      setUsername(userToVerify);
      setCurrentPassword(passToVerify.trim());
      setView('dashboard');

      // 3. Persist active session in localStorage so closing and reopening tab resumes immediately!
      localStorage.setItem('focus_session', JSON.stringify({
        roomId: activeRoomId,
        password: passToVerify.trim(),
        username: userToVerify
      }));

      // 4. Notify Chrome Extension content script for immediate zero-touch background sync
      window.postMessage({
        type: 'ZERO_TRUST_SYNC_ROOM',
        roomId: activeRoomId,
        password: passToVerify.trim(),
        username: userToVerify
      }, '*');
    } catch (err) {
      console.error('Join error:', err);
      setJoinError('Could not connect to server. Is backend running?');
    }
  };

  useEffect(() => {
    fetchRooms();

    socket.on('rooms_list_update', () => {
      fetchRooms();
    });

    socket.on('room_update', (data) => {
      setCurrentRoom(data);
      if (data.finalLeaderboard && data.status === 'ended') {
        setActiveLeaderboard(data.finalLeaderboard);
      }
    });

    socket.on('room_ended', (data) => {
      setActiveLeaderboard(data.finalLeaderboard);
      setShowLeaderboardModal(true);
      fetchRooms();
    });

    socket.on('room_deleted', (data) => {
      if (currentRoomRef.current?.id === data.roomId) {
        alert('This room was deleted.');
        setView('hub');
        setCurrentRoom(null);
        localStorage.removeItem('focus_session');
      }
      fetchRooms();
    });

    socket.on('distraction_alert', (data) => {
      const isRecurring = data.alertType === 'recurring';
      const isWarning = data.alertType === 'warning';
      setAlerts(prev => [
        ...prev,
        isWarning
          ? `! ${data.username}: ${data.message}`
          : isRecurring
          ? `${data.username}: ${data.message}`
          : `[ALERT] ${data.username} opened distracting site: ${data.url}`
      ]);
      setTimeout(() => {
        setAlerts(prev => prev.slice(1));
      }, 6000);
    });

    // User was kicked out of the room (from API heartbeat)
    socket.on('user_kicked', (data) => {
      setAlerts(prev => [...prev, `[BANNED] ${data.message}`]);
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
      socket.off('room_ended');
      socket.off('room_deleted');
      socket.off('distraction_alert');
      socket.off('user_kicked');
      socket.off('kicked_from_room');
    };
  }, []);

  // Live global ticker for all countdowns (hub cards and dashboard)
  const [currentNow, setCurrentNow] = useState(Date.now());
  useEffect(() => {
    const ticker = setInterval(() => setCurrentNow(Date.now()), 1000);
    return () => clearInterval(ticker);
  }, []);

  // Live countdown timer for active room lifetime in dashboard
  useEffect(() => {
    if (!currentRoom?.endsAt || currentRoom?.status === 'ended') {
      setTimeRemaining(null);
      return;
    }
    const updateTick = () => {
      const left = Math.max(0, Math.round((currentRoom.endsAt - Date.now()) / 1000));
      setTimeRemaining(left);
    };
    updateTick();
    const interval = setInterval(updateTick, 1000);
    return () => clearInterval(interval);
  }, [currentRoom]);

  // Ensure auth form inputs start completely blank on startup / refresh
  useEffect(() => {
    setAuthIdentifier('');
    setAuthEmail('');
    setAuthRegUsername('');
    setAuthPassword('');
    setAuthConfirmPassword('');
    setAuthOtp('');
    setAuthNewPassword('');
    setJoinPassword('');

    const saved = localStorage.getItem('focus_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.roomId && parsed.username) {
          setUsername(parsed.username);
          setSelectedRoomId(parsed.roomId);
          handleJoin(parsed.roomId, parsed.password || '', parsed.username);
        }
      } catch (err) {
        console.debug('Failed to restore session:', err);
      }
    }
  }, []);

  // -- URL Rule Management --
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

  // -- Helper: D/H/M/S -> total seconds --
  const toSec = (d, h, m, s) =>
    (Number(d) || 0) * 86400 +
    (Number(h) || 0) * 3600 +
    (Number(m) || 0) * 60 +
    (Number(s) || 0);

  // -- Helper: total seconds -> human label --
  const secsToLabel = (total) => {
    if (!total || total <= 0) return '0s';
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const parts = [d && `${d}d`, h && `${h}h`, m && `${m}m`, s && `${s}s`].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : '0s';
  };

  // -- Helper: total seconds -> { d, h, m, s } --
  const secToDhms = (totalSec) => {
    if (!totalSec || totalSec <= 0) return { d: 0, h: 0, m: 0, s: 0 };
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = Math.floor(totalSec % 60);
    return { d, h, m, s };
  };

  // -- Create Room & Immediately Enter Dashboard --
  const handleCreateRoom = async () => {
    const alertIntervalSec = Math.max(1, toSec(alertD, alertH, alertM, alertS));
    const maxDistSec = kickEnabled ? toSec(kickD, kickH, kickM, kickS) : null;
    const lifetimeSec = lifeEnabled ? toSec(lifeD, lifeH, lifeM, lifeS) : null;
    const activeUser = username.trim() || 'Host';

    try {
      const res = await fetch(`${BACKEND}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createRoomName.trim() || 'My Focus Room',
          password: createPassword.trim(),
          creator: activeUser,
          config: {
            productive: productiveRules,
            distracting: distractingRules,
            distractionIntervalSec: alertIntervalSec,
            maxDistractionSec: maxDistSec && maxDistSec > 0 ? maxDistSec : null,
            lifetimeSec: lifetimeSec && lifetimeSec > 0 ? lifetimeSec : null
          }
        })
      });

      if (res.ok) {
        const createdRoom = await res.json();
        setUsername(activeUser);
        fetchRooms();
        // Immediately enter the newly created room with its actual password!
        const finalPass = (createdRoom.password || createPassword || '').trim();
        handleJoin(createdRoom.id, finalPass, activeUser);
      }
    } catch (err) {
      console.error('Failed to create room:', err);
      alert('Could not connect to backend server.');
    }
  };

  // -- End Focus Session Early & Open Final Leaderboard --
  const handleEndSessionEarly = async () => {
    if (!currentRoom?.id) return;
    if (!window.confirm('Are you sure you want to end this focus session early and see the final results?')) return;

    try {
      const res = await fetch(`${BACKEND}/api/rooms/${currentRoom.id}/end`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.finalLeaderboard) {
        setActiveLeaderboard(data.finalLeaderboard);
        setShowLeaderboardModal(true);
      }
      fetchRooms();
    } catch (err) {
      console.error('Failed to end room early:', err);
    }
  };

  // -- Open Leaderboard for a Room --
  const handleOpenLeaderboard = (room) => {
    const r = room || currentRoom;
    if (r?.finalLeaderboard && r.finalLeaderboard.length > 0) {
      setActiveLeaderboard(r.finalLeaderboard);
    } else {
      // Calculate live leaderboard ranking
      const users = [...(r?.users || [])].sort((a, b) => {
        const pDiff = (b.productiveSec || 0) - (a.productiveSec || 0);
        if (pDiff !== 0) return pDiff;
        return (a.distractingSec || 0) - (b.distractingSec || 0);
      });
      setActiveLeaderboard(users.map((u, i) => ({
        rank: i + 1,
        username: u.username,
        productiveSec: u.productiveSec || 0,
        distractingSec: u.distractingSec || 0,
        untrackedSec: u.untrackedSec || 0,
        productivityRatio: (u.productiveSec + u.distractingSec) > 0 ? Math.round((u.productiveSec / (u.productiveSec + u.distractingSec)) * 100) : 100,
        isWinner: i === 0 && u.productiveSec > 0
      })));
    }
    setShowLeaderboardModal(true);
  };

  // -- Password Protected Delete Room --
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

  // Creator check: Only the room creator (or original host) can edit settings
  const roomCreatorName = currentRoom?.creator || currentRoom?.users?.[0]?.username || '';
  const isCreator = Boolean(
    username && roomCreatorName && (
      username.trim().toLowerCase() === roomCreatorName.trim().toLowerCase()
    )
  );

  // -- Room Settings Handlers (Creator Only) --
  const handleOpenSettingsModal = () => {
    if (!currentRoom) return;
    setEditRoomName(currentRoom.name || '');

    const prod = (currentRoom.config?.productive || []).map(r => (typeof r === 'string' ? r : r.url));
    setEditProdRules([...prod]);
    setNewEditProdUrl('');

    const dist = (currentRoom.config?.distracting || []).map(r => (typeof r === 'string' ? r : r.url));
    setEditDistRules([...dist]);
    setNewEditDistUrl('');

    const alertSec = currentRoom.config?.distractionIntervalSec || 60;
    const a = secToDhms(alertSec);
    setEditAlertD(a.d);
    setEditAlertH(a.h);
    setEditAlertM(a.m);
    setEditAlertS(a.s);

    const maxDist = currentRoom.config?.maxDistractionSec;
    if (maxDist && maxDist > 0) {
      setEditKickEnabled(true);
      const k = secToDhms(maxDist);
      setEditKickD(k.d);
      setEditKickH(k.h);
      setEditKickM(k.m);
      setEditKickS(k.s);
    } else {
      setEditKickEnabled(false);
      setEditKickD(0);
      setEditKickH(2);
      setEditKickM(0);
      setEditKickS(0);
    }

    const lifeSec = currentRoom.config?.lifetimeSec;
    if (lifeSec && lifeSec > 0) {
      setEditLifeEnabled(true);
      const l = secToDhms(lifeSec);
      setEditLifeD(l.d);
      setEditLifeH(l.h);
      setEditLifeM(l.m);
      setEditLifeS(l.s);
    } else {
      setEditLifeEnabled(false);
      setEditLifeD(0);
      setEditLifeH(10);
      setEditLifeM(0);
      setEditLifeS(0);
    }

    setSettingsError('');
    setSettingsSuccess('');
    setShowSettingsModal(true);
  };

  const handleAddEditProdRule = () => {
    const val = newEditProdUrl.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (val && !editProdRules.includes(val)) {
      setEditProdRules(prev => [...prev, val]);
      setNewEditProdUrl('');
    }
  };

  const handleRemoveEditProdRule = (siteToRemove) => {
    setEditProdRules(prev => prev.filter(s => s !== siteToRemove));
  };

  const handleAddEditDistRule = () => {
    const val = newEditDistUrl.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (val && !editDistRules.includes(val)) {
      setEditDistRules(prev => [...prev, val]);
      setNewEditDistUrl('');
    }
  };

  const handleRemoveEditDistRule = (siteToRemove) => {
    setEditDistRules(prev => prev.filter(s => s !== siteToRemove));
  };

  const handleSaveSettings = async () => {
    if (!currentRoom?.id) return;
    setSettingsSaving(true);
    setSettingsError('');
    setSettingsSuccess('');

    const alertIntervalSec = Math.max(1, toSec(editAlertD, editAlertH, editAlertM, editAlertS));
    const maxDistSec = editKickEnabled ? toSec(editKickD, editKickH, editKickM, editKickS) : null;
    const lifetimeSec = editLifeEnabled ? toSec(editLifeD, editLifeH, editLifeM, editLifeS) : null;

    try {
      const res = await fetch(`${BACKEND}/api/rooms/${currentRoom.id}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          requester: username.trim(),
          password: (currentPassword || '').trim(),
          name: editRoomName.trim() || currentRoom.name,
          productive: editProdRules,
          distracting: editDistRules,
          distractionIntervalSec: alertIntervalSec,
          maxDistractionSec: maxDistSec && maxDistSec > 0 ? maxDistSec : null,
          lifetimeSec: lifetimeSec && lifetimeSec > 0 ? lifetimeSec : null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setSettingsError(data.error || 'Failed to update room settings.');
        setSettingsSaving(false);
        return;
      }

      if (data.room) {
        setCurrentRoom(data.room);
      }
      setSettingsSuccess('Room settings updated successfully!');
      setTimeout(() => {
        setShowSettingsModal(false);
        setSettingsSuccess('');
      }, 1000);
      fetchRooms();
    } catch (err) {
      console.error('Settings save error:', err);
      setSettingsError('Failed to communicate with server.');
    } finally {
      setSettingsSaving(false);
    }
  };

  // -- Render Settings Modal (Room Creator Only) --
  const renderSettingsModal = () => {
    if (!showSettingsModal || !isCreator) return null;
    return (
      <div className="leaderboard-modal-overlay" onClick={() => !settingsSaving && setShowSettingsModal(false)}>
        <div className="leaderboard-modal-card settings-modal-card" onClick={e => e.stopPropagation()}>
          <div className="leaderboard-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h2 className="leaderboard-title" style={{ fontSize: '1.45rem' }}>Room Settings & Rules Control</h2>
                <span className="creator-badge">Creator Only</span>
              </div>
              <p className="leaderboard-subtitle">
                Customize websites, alert frequencies, auto-kick thresholds, and session duration in real time.
              </p>
            </div>
            <button className="modal-close-btn" onClick={() => !settingsSaving && setShowSettingsModal(false)}>✕</button>
          </div>

          {settingsError && (
            <div className="settings-error-banner">
              ⚠️ {settingsError}
            </div>
          )}
          {settingsSuccess && (
            <div className="settings-success-banner">
              ✅ {settingsSuccess}
            </div>
          )}

          <div className="settings-modal-body">
            {/* Room Name */}
            <div className="form-field-group">
              <label className="field-label">Focus Room Name:</label>
              <input
                type="text"
                className="input-field"
                placeholder="Room Name"
                value={editRoomName}
                onChange={e => setEditRoomName(e.target.value)}
              />
            </div>

            {/* URL Rules Configuration */}
            <div className="config-columns" style={{ margin: '0.5rem 0' }}>
              {/* Productive Column */}
              <div className="config-section productive-section">
                <div className="config-section-title">
                  <span className="config-dot productive-dot" />
                  <span>Productive Websites</span>
                  <span className="config-hint">Tracked as Focus Time</span>
                </div>

                <div className="url-list">
                  {editProdRules.map((url, idx) => (
                    <div key={idx} className="url-chip productive-chip">
                      <span className="url-chip-text">{url}</span>
                      <button
                        type="button"
                        className="url-chip-remove"
                        onClick={() => handleRemoveEditProdRule(url)}
                        title="Remove website"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {editProdRules.length === 0 && (
                    <div className="strip-none">No productive websites added</div>
                  )}
                </div>

                <div className="url-add-row">
                  <input
                    className="input-field input-sm"
                    placeholder="e.g. codeforces.com"
                    value={newEditProdUrl}
                    onChange={(e) => setNewEditProdUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddEditProdRule())}
                  />
                  <button
                    type="button"
                    className="btn-add btn-add-productive"
                    onClick={handleAddEditProdRule}
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
                  {editDistRules.map((url, idx) => (
                    <div key={idx} className="url-chip distracting-chip">
                      <span className="url-chip-text">{url}</span>
                      <button
                        type="button"
                        className="url-chip-remove"
                        onClick={() => handleRemoveEditDistRule(url)}
                        title="Remove website"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {editDistRules.length === 0 && (
                    <div className="strip-none">No distracting websites added</div>
                  )}
                </div>

                <div className="url-add-row">
                  <input
                    className="input-field input-sm"
                    placeholder="e.g. youtube.com"
                    value={newEditDistUrl}
                    onChange={(e) => setNewEditDistUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddEditDistRule())}
                  />
                  <button
                    type="button"
                    className="btn-add btn-add-distracting"
                    onClick={handleAddEditDistRule}
                    title="Add Website"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Distraction Alert Interval */}
            <div className="form-field-group">
              <div className="field-label-row">
                <label className="field-label">Distraction Alert Interval:</label>
                <span className="time-badge-preview">
                  Interval: <strong>{secsToLabel(toSec(editAlertD, editAlertH, editAlertM, editAlertS)) || '1m'}</strong>
                </span>
              </div>
              <div className="time-picker-row">
                <div className="time-picker-unit">
                  <input
                    type="number"
                    min="0"
                    max="365"
                    className="time-picker-input"
                    value={editAlertD}
                    onFocus={e => e.target.select()}
                    onChange={e => setEditAlertD(Math.max(0, parseInt(e.target.value, 10) || 0))}
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
                    value={editAlertH}
                    onFocus={e => e.target.select()}
                    onChange={e => setEditAlertH(Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0)))}
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
                    value={editAlertM}
                    onFocus={e => e.target.select()}
                    onChange={e => setEditAlertM(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
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
                    value={editAlertS}
                    onFocus={e => e.target.select()}
                    onChange={e => setEditAlertS(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                  />
                  <span className="time-picker-label">sec</span>
                </div>
                <div className="time-picker-preview alert-preview">
                  {secsToLabel(toSec(editAlertD, editAlertH, editAlertM, editAlertS)) || '0s'}
                </div>
              </div>
              <div className="field-hint">Recurring reminder alert triggers every this duration while staying on a distracting site.</div>
            </div>

            {/* Max Distraction Kick Limit */}
            <div className="form-field-group">
              <div className="field-label-row">
                <label className="field-label">! Max Distraction Time (Kick Limit):</label>
                {editKickEnabled ? (
                  <span className="time-badge-preview kick-badge-active">
                    Kick at: <strong>{secsToLabel(toSec(editKickD, editKickH, editKickM, editKickS)) || '2h'}</strong>
                  </span>
                ) : (
                  <span className="time-badge-preview kick-badge-off">
                    Kick disabled (Unlimited)
                  </span>
                )}
              </div>

              <div className="kick-toggle-row">
                <label className="kick-toggle-label">
                  <input
                    type="checkbox"
                    className="kick-checkbox"
                    checked={editKickEnabled}
                    onChange={e => setEditKickEnabled(e.target.checked)}
                  />
                  <span className="kick-toggle-text">Enable automatic kick & ban limit</span>
                </label>
              </div>

              {editKickEnabled && (
                <div className="time-picker-row">
                  <div className="time-picker-unit">
                    <input
                      type="number"
                      min="0"
                      max="365"
                      className="time-picker-input"
                      value={editKickD}
                      onFocus={e => e.target.select()}
                      onChange={e => setEditKickD(Math.max(0, parseInt(e.target.value, 10) || 0))}
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
                      value={editKickH}
                      onFocus={e => e.target.select()}
                      onChange={e => setEditKickH(Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0)))}
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
                      value={editKickM}
                      onFocus={e => e.target.select()}
                      onChange={e => setEditKickM(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
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
                      value={editKickS}
                      onFocus={e => e.target.select()}
                      onChange={e => setEditKickS(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                    />
                    <span className="time-picker-label">sec</span>
                  </div>
                  <div className="time-picker-preview kick-preview">
                    {secsToLabel(toSec(editKickD, editKickH, editKickM, editKickS)) || '0s'}
                  </div>
                </div>
              )}
              <div className="field-hint">
                {editKickEnabled
                  ? 'If a user accumulates more than this total distracting time, they are permanently removed & banned from the room.'
                  : 'No kick limit - members can stay in the room regardless of time spent on distracting sites.'}
              </div>
            </div>

            {/* Room Lifetime Duration */}
            <div className="form-field-group">
              <div className="field-label-row">
                <label className="field-label">Focus Room Lifetime (Session Limit):</label>
                {editLifeEnabled ? (
                  <span className="time-badge-preview life-badge-active">
                    Duration: <strong>{secsToLabel(toSec(editLifeD, editLifeH, editLifeM, editLifeS)) || '10h'}</strong>
                  </span>
                ) : (
                  <span className="time-badge-preview life-badge-off">
                    Unlimited Duration
                  </span>
                )}
              </div>

              <div className="preset-buttons-row">
                <button
                  type="button"
                  className={`preset-btn ${editLifeEnabled && editLifeD === 0 && editLifeH === 0 && editLifeM === 25 && editLifeS === 0 ? 'active' : ''}`}
                  onClick={() => { setEditLifeEnabled(true); setEditLifeD(0); setEditLifeH(0); setEditLifeM(25); setEditLifeS(0); }}
                >
                  25m Pomodoro
                </button>
                <button
                  type="button"
                  className={`preset-btn ${editLifeEnabled && editLifeD === 0 && editLifeH === 1 && editLifeM === 0 && editLifeS === 0 ? 'active' : ''}`}
                  onClick={() => { setEditLifeEnabled(true); setEditLifeD(0); setEditLifeH(1); setEditLifeM(0); setEditLifeS(0); }}
                >
                  1 Hour
                </button>
                <button
                  type="button"
                  className={`preset-btn ${editLifeEnabled && editLifeD === 0 && editLifeH === 2 && editLifeM === 0 && editLifeS === 0 ? 'active' : ''}`}
                  onClick={() => { setEditLifeEnabled(true); setEditLifeD(0); setEditLifeH(2); setEditLifeM(0); setEditLifeS(0); }}
                >
                  2 Hours
                </button>
                <button
                  type="button"
                  className={`preset-btn ${editLifeEnabled && editLifeD === 0 && editLifeH === 4 && editLifeM === 0 && editLifeS === 0 ? 'active' : ''}`}
                  onClick={() => { setEditLifeEnabled(true); setEditLifeD(0); setEditLifeH(4); setEditLifeM(0); setEditLifeS(0); }}
                >
                  4 Hours
                </button>
                <button
                  type="button"
                  className={`preset-btn ${editLifeEnabled && editLifeD === 0 && editLifeH === 10 && editLifeM === 0 && editLifeS === 0 ? 'active' : ''}`}
                  onClick={() => { setEditLifeEnabled(true); setEditLifeD(0); setEditLifeH(10); setEditLifeM(0); setEditLifeS(0); }}
                >
                  10 Hours
                </button>
                <button
                  type="button"
                  className={`preset-btn ${!editLifeEnabled ? 'active' : ''}`}
                  onClick={() => setEditLifeEnabled(false)}
                >
                  Unlimited
                </button>
              </div>

              {editLifeEnabled && (
                <div className="time-picker-row" style={{ marginTop: '0.6rem' }}>
                  <div className="time-picker-unit">
                    <input
                      type="number"
                      min="0"
                      max="365"
                      className="time-picker-input"
                      value={editLifeD}
                      onFocus={e => e.target.select()}
                      onChange={e => setEditLifeD(Math.max(0, parseInt(e.target.value, 10) || 0))}
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
                      value={editLifeH}
                      onFocus={e => e.target.select()}
                      onChange={e => setEditLifeH(Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0)))}
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
                      value={editLifeM}
                      onFocus={e => e.target.select()}
                      onChange={e => setEditLifeM(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
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
                      value={editLifeS}
                      onFocus={e => e.target.select()}
                      onChange={e => setEditLifeS(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                    />
                    <span className="time-picker-label">sec</span>
                  </div>
                  <div className="time-picker-preview life-preview">
                    {secsToLabel(toSec(editLifeD, editLifeH, editLifeM, editLifeS)) || '0s'}
                  </div>
                </div>
              )}
              <div className="field-hint">
                Changing duration updates the countdown dynamically for all active room participants.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowSettingsModal(false)}
              disabled={settingsSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-save-settings"
              onClick={handleSaveSettings}
              disabled={settingsSaving}
            >
              {settingsSaving ? 'Saving Changes...' : 'Save Room Settings'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // -- Render Leaderboard Modal --
  const renderLeaderboardModal = () => {
    if (!showLeaderboardModal) return null;
    return (
      <div className="leaderboard-modal-overlay" onClick={() => setShowLeaderboardModal(false)}>
        <div className="leaderboard-modal-card" onClick={e => e.stopPropagation()}>
          <div className="leaderboard-header">
            <div>
              <h2 className="leaderboard-title">Focus Session Results & Leaderboard</h2>
              <p className="leaderboard-subtitle">
                Official Ranking · <span className="rule-highlight">Rule: The person who has more productive time wins always!</span>
              </p>
            </div>
            <button className="modal-close-btn" onClick={() => setShowLeaderboardModal(false)}>✕</button>
          </div>

          {/* Winner Spotlight Card */}
          {activeLeaderboard && activeLeaderboard.length > 0 && activeLeaderboard[0]?.productiveSec > 0 ? (
            <div className="winner-spotlight">
              <div className="winner-crown">👑</div>
              <div className="winner-details">
                <div style={{ fontSize: '0.75rem', color: '#fbbf24', fontWeight: 700, textTransform: 'uppercase' }}>
                  🏆 Focus Session Champion
                </div>
                <h3>{activeLeaderboard[0].username} Won the Focus Session!</h3>
                <div className="winner-meta">
                  <div className="winner-stat text-green">
                    ✓ <strong>{formatTime(activeLeaderboard[0].productiveSec)}</strong> Productive Time
                  </div>
                  <div className="winner-stat text-red">
                    <strong>{formatTime(activeLeaderboard[0].distractingSec)}</strong> Distracted Time
                  </div>
                  <div className="winner-stat text-cyan">
                    <strong>{activeLeaderboard[0].productivityRatio}%</strong> Focus Efficiency
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="winner-spotlight" style={{ borderColor: 'rgba(148, 163, 184, 0.3)' }}>
              <div className="winner-crown">🏆</div>
              <div className="winner-details">
                <h3>Session Summary</h3>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>
                  No members have accumulated productive time yet.
                </p>
              </div>
            </div>
          )}

          {/* Leaderboard Table */}
          <div className="leaderboard-table-wrap">
            <table className="leaderboard-tbl">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>Rank</th>
                  <th>Participant</th>
                  <th>Productive Time (Wins)</th>
                  <th>Distracted Time</th>
                  <th>Neutral Time</th>
                  <th>Efficiency</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {(!activeLeaderboard || activeLeaderboard.length === 0) ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                      No participant activity recorded for this session.
                    </td>
                  </tr>
                ) : (
                  activeLeaderboard.map((u, i) => {
                    const isWin = u.isWinner || (i === 0 && u.productiveSec > 0);
                    return (
                      <tr key={i} className={isWin ? 'rank-1-row' : ''}>
                        <td>
                          <span className={`rank-badge ${i === 0 ? 'rank-1-badge' : i === 1 ? 'rank-2-badge' : i === 2 ? 'rank-3-badge' : 'rank-other-badge'}`}>
                            {i === 0 ? '#1 Gold' : i === 1 ? '#2 Silver' : i === 2 ? '#3 Bronze' : `#${i + 1}`}
                          </span>
                        </td>
                        <td>
                          <strong style={{ fontSize: '0.95rem' }}>{u.username}</strong>
                          {isWin && <span style={{ marginLeft: '0.4rem', color: '#fbbf24' }}>👑</span>}
                        </td>
                        <td className="text-green table-mono" style={{ fontWeight: 700 }}>
                          {formatTime(u.productiveSec)}
                        </td>
                        <td className="text-red table-mono">
                          {formatTime(u.distractingSec)}
                        </td>
                        <td className="table-mono" style={{ opacity: 0.6 }}>
                          {formatTime(u.untrackedSec)}
                        </td>
                        <td>
                          <span className="ratio-tag">{u.productivityRatio}%</span>
                        </td>
                        <td>
                          {isWin ? (
                            <span style={{ color: '#fbbf24', fontWeight: 800 }}>WINNER</span>
                          ) : i === 1 ? (
                            <span style={{ color: '#cbd5e1', fontWeight: 700 }}>Runner Up</span>
                          ) : i === 2 ? (
                            <span style={{ color: '#d97706', fontWeight: 700 }}>3rd Place</span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>Participant</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={() => { setShowLeaderboardModal(false); setView('hub'); }}>
              ← Return to Rooms Hub
            </button>
            <button className="btn btn-primary" onClick={() => setShowLeaderboardModal(false)}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ===============================================================
  // BANNED / KICKED VIEW
  // ===============================================================
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

  // ===============================================================
  // VIEW 1: UNIFIED FOCUS HUB
  // ===============================================================
  // ===============================================================
  // AUTH VIEW (Login / Register / Forgot Password / OTP)
  // ===============================================================
  if (view === 'login') {
    const handleLogin = async () => {
      setAuthError(''); setAuthLoading(true);
      try {
        const res = await fetch(`${BACKEND}/api/login`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: authIdentifier, password: authPassword }),
        });
        const data = await res.json();
        if (!res.ok) { setAuthError(data.error || 'Login failed.'); setAuthLoading(false); return; }
        setUsername(data.username);
        setView('hub');
      } catch { setAuthError('Cannot reach server.'); }
      setAuthLoading(false);
    };

    const handleRegister = async () => {
      setAuthError(''); setAuthSuccess('');
      if (authPassword !== authConfirmPassword) { setAuthError('Passwords do not match.'); return; }
      setAuthLoading(true);
      try {
        const res = await fetch(`${BACKEND}/api/register`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: authRegUsername, email: authEmail, password: authPassword }),
        });
        const data = await res.json();
        if (!res.ok) { setAuthError(data.error || 'Registration failed.'); setAuthLoading(false); return; }
        setAuthSuccess('Account created! Please log in.');
        setAuthMode('login');
      } catch { setAuthError('Cannot reach server.'); }
      setAuthLoading(false);
    };

    const handleForgot = async () => {
      setAuthError(''); setAuthLoading(true);
      try {
        const res = await fetch(`${BACKEND}/api/forgot`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: authEmail }),
        });
        const data = await res.json();
        if (!res.ok) { setAuthError(data.error || 'Failed.'); setAuthLoading(false); return; }
        setLoggedInEmail(authEmail);
        setAuthSuccess(data.message || 'OTP sent!');
        setAuthMode('otp');
      } catch { setAuthError('Cannot reach server.'); }
      setAuthLoading(false);
    };

    const handleVerifyOtp = async () => {
      setAuthError(''); setAuthLoading(true);
      try {
        const res = await fetch(`${BACKEND}/api/verify-otp`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: loggedInEmail, code: authOtp, newPassword: authNewPassword }),
        });
        const data = await res.json();
        if (!res.ok) { setAuthError(data.error || 'Failed.'); setAuthLoading(false); return; }
        setAuthSuccess('Password reset! Please log in.');
        setAuthMode('login');
      } catch { setAuthError('Cannot reach server.'); }
      setAuthLoading(false);
    };

    return (
      <>
        <div className="app-bg">
          <div className="orb orb-1" />
          <div className="orb orb-2" />
          <div className="orb orb-3" />
        </div>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', position: 'relative', zIndex: 1 }}>
          <div style={{
            background: 'rgba(15,23,42,0.85)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(99,102,241,0.35)',
            borderRadius: '24px',
            padding: '2.5rem 2.5rem 2rem',
            width: '100%',
            maxWidth: '440px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.1)',
          }}>
            {/* Logo */}
            <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
              <div style={{ fontSize: '2.8rem', marginBottom: '0.5rem' }}></div>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Zero-Trust Focus</h1>
              <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.3rem' }}>
                {authMode === 'login' && 'Sign in to your account'}
                {authMode === 'register' && 'Create a new account'}
                {authMode === 'forgot' && 'Reset your password'}
                {authMode === 'otp' && 'Enter the OTP sent to your email'}
              </p>
            </div>

            {/* Error / Success banners */}
            {authError && <div style={{ background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.4)', borderRadius:'10px', padding:'0.65rem 1rem', marginBottom:'1rem', color:'#fca5a5', fontSize:'0.85rem' }}>! {authError}</div>}
            {authSuccess && <div style={{ background:'rgba(6,214,160,0.12)', border:'1px solid rgba(6,214,160,0.4)', borderRadius:'10px', padding:'0.65rem 1rem', marginBottom:'1rem', color:'#6ee7b7', fontSize:'0.85rem' }}>✓ {authSuccess}</div>}

            {/* -- LOGIN FORM -- */}
            {authMode === 'login' && (<form onSubmit={e => e.preventDefault()} autoComplete="off">
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display:'block', color:'#94a3b8', fontSize:'0.8rem', marginBottom:'0.4rem', fontWeight:600 }}>EMAIL OR USERNAME</label>
                <input className="input-field" type="text" placeholder="e.g. sahaj or sahaj@gmail.com"
                  value={authIdentifier} onChange={e => { setAuthIdentifier(e.target.value); setAuthError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  style={{ width:'100%', boxSizing:'border-box' }} autoComplete="off" data-lpignore="true" />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display:'block', color:'#94a3b8', fontSize:'0.8rem', marginBottom:'0.4rem', fontWeight:600 }}>PASSWORD</label>
                <input className="input-field" type="password" placeholder="Your password"
                  value={authPassword} onChange={e => { setAuthPassword(e.target.value); setAuthError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  style={{ width:'100%', boxSizing:'border-box' }} autoComplete="new-password" data-lpignore="true" />
              </div>
              <button className="btn btn-primary" type="button" style={{ width:'100%', padding:'0.85rem', fontSize:'1rem', fontWeight:700 }}
                onClick={handleLogin} disabled={authLoading}>
                {authLoading ? "Signing in..." : "Sign In →"}
              </button>
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:'1.1rem', fontSize:'0.82rem' }}>
                <a href="#" style={{ color:'#818cf8', textDecoration:'none' }} onClick={e => { e.preventDefault(); setAuthMode('forgot'); setAuthError(''); setAuthSuccess(''); }}>Forgot password?</a>
                <a href="#" style={{ color:'#818cf8', textDecoration:'none' }} onClick={e => { e.preventDefault(); setAuthMode('register'); setAuthError(''); setAuthSuccess(''); }}>Create account →</a>
              </div>
            </form>)}

            {/* -- REGISTER FORM -- */}
            {authMode === 'register' && (<form onSubmit={e => e.preventDefault()} autoComplete="off">
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display:'block', color:'#94a3b8', fontSize:'0.8rem', marginBottom:'0.4rem', fontWeight:600 }}>USERNAME</label>
                <input className="input-field" type="text" placeholder="e.g. Sahaj"
                  value={authRegUsername} onChange={e => { setAuthRegUsername(e.target.value); setAuthError(''); }}
                  style={{ width:'100%', boxSizing:'border-box' }} autoComplete="off" data-lpignore="true" />
              </div>
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display:'block', color:'#94a3b8', fontSize:'0.8rem', marginBottom:'0.4rem', fontWeight:600 }}>EMAIL</label>
                <input className="input-field" type="email" placeholder="e.g. sahaj@gmail.com"
                  value={authEmail} onChange={e => { setAuthEmail(e.target.value); setAuthError(''); }}
                  style={{ width:'100%', boxSizing:'border-box' }} autoComplete="off" data-lpignore="true" />
              </div>
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display:'block', color:'#94a3b8', fontSize:'0.8rem', marginBottom:'0.4rem', fontWeight:600 }}>PASSWORD</label>
                <input className="input-field" type="password" placeholder="Create a strong password"
                  value={authPassword} onChange={e => { setAuthPassword(e.target.value); setAuthError(''); }}
                  style={{ width:'100%', boxSizing:'border-box' }} autoComplete="new-password" data-lpignore="true" />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display:'block', color:'#94a3b8', fontSize:'0.8rem', marginBottom:'0.4rem', fontWeight:600 }}>CONFIRM PASSWORD</label>
                <input className="input-field" type="password" placeholder="Repeat password"
                  value={authConfirmPassword} onChange={e => { setAuthConfirmPassword(e.target.value); setAuthError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleRegister()}
                  style={{ width:'100%', boxSizing:'border-box' }} autoComplete="new-password" data-lpignore="true" />
              </div>
              <button className="btn btn-primary" type="button" style={{ width:'100%', padding:'0.85rem', fontSize:'1rem', fontWeight:700 }}
                onClick={handleRegister} disabled={authLoading}>
                {authLoading ? "Creating account..." : "Create Account →"}
              </button>
              <div style={{ textAlign:'center', marginTop:'1.1rem', fontSize:'0.82rem' }}>
                <a href="#" style={{ color:'#818cf8', textDecoration:'none' }} onClick={e => { e.preventDefault(); setAuthMode('login'); setAuthError(''); setAuthSuccess(''); }}>← Back to login</a>
              </div>
            </form>)}

            {/* -- FORGOT PASSWORD FORM -- */}
            {authMode === 'forgot' && (<form onSubmit={e => e.preventDefault()} autoComplete="off">
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display:'block', color:'#94a3b8', fontSize:'0.8rem', marginBottom:'0.4rem', fontWeight:600 }}>ACCOUNT EMAIL</label>
                <input className="input-field" type="email" placeholder="e.g. sahaj@gmail.com"
                  value={authEmail} onChange={e => { setAuthEmail(e.target.value); setAuthError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleForgot()}
                  style={{ width:'100%', boxSizing:'border-box' }} autoComplete="off" data-lpignore="true" />
                <p style={{ color:'#64748b', fontSize:'0.78rem', marginTop:'0.4rem' }}>We'll send a 6-digit OTP to this email.</p>
              </div>
              <button className="btn btn-primary" type="button" style={{ width:'100%', padding:'0.85rem', fontSize:'1rem', fontWeight:700 }}
                onClick={handleForgot} disabled={authLoading}>
                {authLoading ? "Sending OTP..." : "Send OTP →"}
              </button>
              <div style={{ textAlign:'center', marginTop:'1.1rem', fontSize:'0.82rem' }}>
                <a href="#" style={{ color:'#818cf8', textDecoration:'none' }} onClick={e => { e.preventDefault(); setAuthMode('login'); setAuthError(''); setAuthSuccess(''); }}>← Back to login</a>
              </div>
            </form>)}

            {/* -- OTP VERIFY FORM -- */}
            {authMode === 'otp' && (<form onSubmit={e => e.preventDefault()} autoComplete="off">
              <p style={{ color:'#64748b', fontSize:'0.82rem', marginBottom:'1rem' }}>OTP sent to <strong style={{color:'#818cf8'}}>{loggedInEmail}</strong>. Check inbox (or server console in dev mode).</p>
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display:'block', color:'#94a3b8', fontSize:'0.8rem', marginBottom:'0.4rem', fontWeight:600 }}>6-DIGIT OTP</label>
                <input className="input-field" type="text" placeholder="e.g. 483920" maxLength={6}
                  value={authOtp} onChange={e => { setAuthOtp(e.target.value.replace(/\D/,'')); setAuthError(''); }}
                  style={{ width:'100%', boxSizing:'border-box', letterSpacing:'6px', fontSize:'1.4rem', textAlign:'center' }} autoComplete="off" data-lpignore="true" />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display:'block', color:'#94a3b8', fontSize:'0.8rem', marginBottom:'0.4rem', fontWeight:600 }}>NEW PASSWORD</label>
                <input className="input-field" type="password" placeholder="Enter new password"
                  value={authNewPassword} onChange={e => { setAuthNewPassword(e.target.value); setAuthError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleVerifyOtp()}
                  style={{ width:'100%', boxSizing:'border-box' }} autoComplete="new-password" data-lpignore="true" />
              </div>
              <button className="btn btn-primary" type="button" style={{ width:'100%', padding:'0.85rem', fontSize:'1rem', fontWeight:700 }}
                onClick={handleVerifyOtp} disabled={authLoading}>
                {authLoading ? "Resetting..." : "Reset Password →"}
              </button>
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:'1.1rem', fontSize:'0.82rem' }}>
                <a href="#" style={{ color:'#818cf8', textDecoration:'none' }} onClick={e => { e.preventDefault(); setAuthMode('forgot'); setAuthError(''); setAuthSuccess(''); }}>Resend OTP</a>
                <a href="#" style={{ color:'#818cf8', textDecoration:'none' }} onClick={e => { e.preventDefault(); setAuthMode('login'); setAuthError(''); setAuthSuccess(''); }}>← Back to login</a>
              </div>
            </form>)}
          </div>
        </div>
      </>
    );
  }
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
                <div className="login-shield small-shield"></div>
                <div>
                  <h1 className="rooms-main-title">Zero-Trust Focus Hub</h1>
                  <p className="rooms-main-subtitle">Real-time time spent tracker on productive vs distracting tabs</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {username && <span style={{ color: '#818cf8', fontSize: '0.82rem', fontWeight: 600 }}>👤 {username}</span>}
                <button className="btn btn-secondary" style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}
                  onClick={() => setView('history')}>History</button>
                <button className="btn" style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', background: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px' }}
                  onClick={() => { setUsername(''); setView('login'); setAuthMode('login'); setAuthPassword(''); setAuthIdentifier(''); }}>
                  Logout
                </button>
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
                  ! {joinError}
                </div>
              )}
            </div>

            {/* Resume Active Session Banner if user has a running session in background */}
            {(() => {
              let stored = null;
              try { stored = JSON.parse(localStorage.getItem('focus_session')); } catch (e) {}
              const activeSession = currentRoom || (stored?.roomId ? stored : null);
              if (!activeSession) return null;

              const isLiveRoom = Boolean(currentRoom);
              const roomName = currentRoom?.name || (roomsList.find(r => r.id === stored?.roomId)?.name) || stored?.roomId || 'Focus Room';
              const endsAtVal = currentRoom?.endsAt || (roomsList.find(r => r.id === stored?.roomId)?.endsAt);

              return (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(6, 214, 160, 0.15), rgba(56, 189, 248, 0.15))',
                  border: '1px solid rgba(6, 214, 160, 0.4)',
                  borderRadius: '14px',
                  padding: '0.9rem 1.4rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.25)'
                }}>
                  <div>
                    <div style={{ fontWeight: 800, color: '#06d6a0', fontSize: '0.95rem' }}>
                      âš¡ Focus Session "{roomName}" is Running!
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                      {endsAtVal
                        ? `Session Ends In: ${formatTime(Math.max(0, Math.round((endsAtVal - currentNow) / 1000)))}`
                        : "Unlimited duration"}
                      {stored?.username ? ` · User: ${stored.username}` : ''}
                    </div>
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ padding: '0.5rem 1.1rem', fontSize: '0.85rem' }}
                    onClick={() => {
                      if (isLiveRoom) {
                        setView('dashboard');
                      } else if (stored) {
                        handleJoin(stored.roomId, stored.password, stored.username);
                      }
                    }}
                  >
                    Resume Running Dashboard →
                  </button>
                </div>
              );
            })()}

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
                Refresh
              </button>
            </div>

            {loadingRooms && roomsList.length === 0 && (
              <div className="rooms-loading">Loading rooms...</div>
            )}

            {roomsList.length === 0 && !loadingRooms && (
              <div className="rooms-empty-card">
                <div className="empty-icon">🏠</div>
                <h3>No rooms active</h3>
                <p>Click the button below to create a room with custom productive and distracting websites.</p>
              </div>
            )}

            <div className="rooms-grid">
              {roomsList.map((r) => {
                const isEnded = r.status === 'ended' || (r.endsAt && (r.endsAt - currentNow) <= 0);
                const liveLeft = r.endsAt ? Math.max(0, Math.round((r.endsAt - currentNow) / 1000)) : null;

                return (
                <div key={r.id} className="room-item-card">
                  <div className="room-card-top">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <h3 className="room-name">{r.name}</h3>
                        {isEnded ? (
                          <span className="room-status-tag status-tag-ended"> Session Ended</span>
                        ) : liveLeft !== null ? (
                          <span className="room-status-tag status-tag-active">⏱ {formatTime(liveLeft)} Left</span>
                        ) : (
                          <span className="room-status-tag status-tag-active">Active</span>
                        )}
                      </div>
                      <div className="room-privacy-tag">
                        🔒 Password Protected · Alert every {formatTime(r.distractionIntervalSec || 60)}
                        {r.lifetimeSec ? ` · Duration: ${formatTime(r.lifetimeSec)}` : ' · Unlimited duration'}
                        {r.maxDistractionSec ? ` · Kick limit: ${formatTime(r.maxDistractionSec)}` : ' · No kick limit'}
                      </div>
                    </div>
                    <button
                      className="room-delete-btn"
                      onClick={(e) => handleDeleteRoom(r, e)}
                      title="Delete room (Requires Password)"
                    >
                      
                    </button>
                  </div>

                  {/* Room Summary Overview */}
                  <div className="room-rules-overview">
                    <div className="rule-badge-row">
                      <span className="room-rule-pill pill-prod">
                        Productive URLs: {r.productiveCount}
                      </span>
                      <span className="room-rule-pill pill-dist">
                        Distracting URLs: {r.distractingCount}
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
                      {r.userCount} member{r.userCount === 1 ? '' : 's'}
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {(r.status === 'ended' || (r.finalLeaderboard && r.finalLeaderboard.length > 0)) && (
                        <button
                          className="btn btn-secondary btn-join-card"
                          style={{ padding: '0.45rem 0.8rem', fontSize: '0.8rem', color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.4)' }}
                          onClick={() => handleOpenLeaderboard(r)}
                        >
                          Results
                        </button>
                      )}
                      <button
                        className="btn btn-primary btn-join-card"
                        onClick={() => {
                          setSelectedRoomId(r.id);
                          let user = (username || '').trim();
                          if (!user) {
                            user = window.prompt(`Enter your Username to join "${r.name}":`) || '';
                            if (!user.trim()) return;
                            user = user.trim();
                            setUsername(user);
                          }
                          const enteredPass = window.prompt(`Enter Password for room "${r.name}":`);
                          if (enteredPass !== null) {
                            handleJoin(r.id, enteredPass.trim(), user);
                          }
                        }}
                      >
                        {r.status === 'ended' ? 'Enter Room →' : 'Join Room →'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
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
        {renderLeaderboardModal()}
      </>
    );
  }

  // ===============================================================
  // HISTORY VIEW
  // ===============================================================
  if (view === 'history') {
    const fmt = (ts) => {
      if (!ts) return "-";
      const d = new Date(ts);
      return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
        + ' ' + d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12: true });
    };
    return (
      <>
        <div className="app-bg"><div className="orb orb-1"/><div className="orb orb-2"/><div className="orb orb-3"/></div>
        <div style={{ minHeight:'100vh', padding:'2rem 1rem', position:'relative', zIndex:1 }}>
          <div style={{ maxWidth:'780px', margin:'0 auto' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1.75rem', flexWrap:'wrap' }}>
              <button className="btn btn-secondary" style={{ padding:'0.45rem 1rem', fontSize:'0.82rem' }}
                onClick={() => setView('hub')}>← Back to Hub</button>
              <div>
                <h2 style={{ color:'#f1f5f9', fontWeight:800, fontSize:'1.4rem', margin:0 }}>My Focus History</h2>
                {username && <p style={{ color:'#64748b', fontSize:'0.82rem', margin:'0.2rem 0 0' }}>Sessions for <strong style={{color:'#818cf8'}}>{username}</strong></p>}
              </div>
            </div>
            {loadingHistory ? (
              <div style={{ textAlign:'center', color:'#64748b', padding:'3rem' }}>Loading history...</div>
            ) : !username ? (
              <div style={{ textAlign:'center', color:'#64748b', padding:'3rem' }}>! Please log in first.</div>
            ) : historyData.length === 0 ? (
              <div style={{ background:'rgba(15,23,42,0.7)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:'16px', padding:'3rem', textAlign:'center', color:'#64748b' }}>
                <div style={{ fontSize:'2.5rem', marginBottom:'0.75rem' }}>📋</div>
                <div style={{ fontWeight:600, color:'#94a3b8' }}>No sessions recorded yet</div>
                <div style={{ fontSize:'0.82rem', marginTop:'0.4rem' }}>Join a Focus Room to start building your history.</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.85rem' }}>
                {[...historyData].reverse().map((entry, i) => {
                  const duration = entry.joinedAt && entry.leftAt ? Math.round((entry.leftAt - entry.joinedAt) / 1000) : null;
                  return (
                    <div key={i} style={{ background:'rgba(15,23,42,0.8)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:'14px', padding:'1.1rem 1.4rem', display:'flex', alignItems:'center', gap:'1.2rem', flexWrap:'wrap', boxShadow:'0 4px 16px rgba(0,0,0,0.25)', transition:'border-color 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor='rgba(99,102,241,0.5)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor='rgba(99,102,241,0.2)'}>
                      <div style={{ background:'linear-gradient(135deg,#6366f1,#818cf8)', borderRadius:'50%', width:'36px', height:'36px', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, color:'#fff', fontSize:'0.85rem', flexShrink:0 }}>{historyData.length - i}</div>
                      <div style={{ flex:1, minWidth:'200px' }}>
                        <div style={{ fontWeight:700, color:'#e2e8f0', fontSize:'0.95rem', marginBottom:'0.3rem' }}> {entry.roomId || 'Unknown Room'}</div>
                        <div style={{ fontSize:'0.8rem', color:'#64748b', display:'flex', flexWrap:'wrap', gap:'0.75rem' }}>
                          <span><span style={{color:'#6ee7b7'}}>Joined:</span> {fmt(entry.joinedAt)}</span>
                          <span><span style={{color:'#fca5a5'}}>Left:</span> {entry.leftAt ? fmt(entry.leftAt) : <span style={{color:'#fbbf24'}}>Still active</span>}</span>
                        </div>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        {duration !== null ? (
                          <><div style={{ fontWeight:700, color:'#818cf8', fontSize:'0.95rem' }}>{formatTime(duration)}</div><div style={{ fontSize:'0.75rem', color:'#64748b' }}>session time</div></>
                        ) : (<div style={{ fontWeight:600, color:'#fbbf24', fontSize:'0.82rem' }}>Active</div>)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // ===============================================================
  // VIEW 2: CONFIGURE ROOM & TIME RULES
  // ===============================================================
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
              <div className="login-shield"></div>
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

              {/* -- Alert Interval: Days / Hours / Mins / Secs -- */}
              <div className="form-field-group">
                <div className="field-label-row">
                  <label className="field-label">Distraction Alert Interval:</label>
                  <span className="time-badge-preview">
                    Interval: <strong>{secsToLabel(toSec(alertD, alertH, alertM, alertS)) || '1m'}</strong>
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

              {/* -- Max Distraction Kick Limit: Days / Hours / Mins / Secs -- */}
              <div className="form-field-group">
                <div className="field-label-row">
                  <label className="field-label">! Max Distraction Time (Kick Limit):</label>
                  {kickEnabled ? (
                    <span className="time-badge-preview kick-badge-active">
                      Kick at: <strong>{secsToLabel(toSec(kickD, kickH, kickM, kickS)) || '2h'}</strong>
                    </span>
                  ) : (
                    <span className="time-badge-preview kick-badge-off">
                      Kick disabled (Unlimited)
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
                    : "No kick limit - members can stay in the room regardless of time spent on distracting sites."}
                </div>
              </div>

              {/* -- Focus Room Lifetime (Session Duration & Leaderboard) -- */}
              <div className="form-field-group">
                <div className="field-label-row">
                  <label className="field-label">Focus Room Lifetime (Session Duration):</label>
                  {lifeEnabled ? (
                    <span className="time-badge-preview lifetime-badge-active">
                       Session Length: <strong>{secsToLabel(toSec(lifeD, lifeH, lifeM, lifeS)) || '10h'}</strong>
                    </span>
                  ) : (
                    <span className="time-badge-preview lifetime-badge-off">
                      Unlimited Duration
                    </span>
                  )}
                </div>

                {/* Quick Presets */}
                <div className="lifetime-presets-row">
                  <button
                    type="button"
                    className={`preset-btn ${lifeEnabled && lifeD === 0 && lifeH === 0 && lifeM === 25 && lifeS === 0 ? 'active' : ''}`}
                    onClick={() => { setLifeEnabled(true); setLifeD(0); setLifeH(0); setLifeM(25); setLifeS(0); }}
                  >
                    25m Pomodoro
                  </button>
                  <button
                    type="button"
                    className={`preset-btn ${lifeEnabled && lifeD === 0 && lifeH === 1 && lifeM === 0 && lifeS === 0 ? 'active' : ''}`}
                    onClick={() => { setLifeEnabled(true); setLifeD(0); setLifeH(1); setLifeM(0); setLifeS(0); }}
                  >
                    1 Hour
                  </button>
                  <button
                    type="button"
                    className={`preset-btn ${lifeEnabled && lifeD === 0 && lifeH === 2 && lifeM === 0 && lifeS === 0 ? 'active' : ''}`}
                    onClick={() => { setLifeEnabled(true); setLifeD(0); setLifeH(2); setLifeM(0); setLifeS(0); }}
                  >
                    2 Hours
                  </button>
                  <button
                    type="button"
                    className={`preset-btn ${lifeEnabled && lifeD === 0 && lifeH === 4 && lifeM === 0 && lifeS === 0 ? 'active' : ''}`}
                    onClick={() => { setLifeEnabled(true); setLifeD(0); setLifeH(4); setLifeM(0); setLifeS(0); }}
                  >
                    4 Hours
                  </button>
                  <button
                    type="button"
                    className={`preset-btn ${lifeEnabled && lifeD === 0 && lifeH === 10 && lifeM === 0 && lifeS === 0 ? 'active' : ''}`}
                    onClick={() => { setLifeEnabled(true); setLifeD(0); setLifeH(10); setLifeM(0); setLifeS(0); }}
                  >
                    10 Hours
                  </button>
                  <button
                    type="button"
                    className={`preset-btn ${!lifeEnabled ? 'active' : ''}`}
                    onClick={() => setLifeEnabled(false)}
                  >
                    Unlimited
                  </button>
                </div>

                {lifeEnabled && (
                  <div className="time-picker-row" style={{ marginTop: '0.6rem' }}>
                    <div className="time-picker-unit">
                      <input
                        type="number"
                        min="0"
                        max="365"
                        className="time-picker-input"
                        value={lifeD}
                        onFocus={e => e.target.select()}
                        onChange={e => setLifeD(Math.max(0, parseInt(e.target.value, 10) || 0))}
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
                        value={lifeH}
                        onFocus={e => e.target.select()}
                        onChange={e => setLifeH(Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0)))}
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
                        value={lifeM}
                        onFocus={e => e.target.select()}
                        onChange={e => setLifeM(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
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
                        value={lifeS}
                        onFocus={e => e.target.select()}
                        onChange={e => setLifeS(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                      />
                      <span className="time-picker-label">sec</span>
                    </div>
                    <div className="time-picker-preview lifetime-preview">
                      {secsToLabel(toSec(lifeD, lifeH, lifeM, lifeS)) || '0s'}
                    </div>
                  </div>
                )}
                <div className="field-hint">
                  The focus room will run for this duration, then automatically end and reveal the final leaderboard. The person with the most productive time wins always!
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
              <strong>How It Works:</strong> The system records exact time spent on productive vs distracting tabs. When opening a distracting tab, an alert fires immediately, followed by a reminder every <strong>{secsToLabel(toSec(alertD, alertH, alertM, alertS)) || '1m'}</strong> if you stay distracted.
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

  // ===============================================================
  // VIEW 3: LIVE TIME-TRACKING DASHBOARD
  // ===============================================================
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
                onClick={handleLeaveRoom}
              >
                ← Exit to Hub
              </button>
              <div className="dash-shield">🛡️</div>
              <div className="dash-title-group">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <h1 className="dash-title">{currentRoom?.name || 'Live Focus Dashboard'}</h1>
                  {isCreator && (
                    <span className="host-creator-pill" title="You created this room and have full administrative privileges">
                      Host (Creator)
                    </span>
                  )}
                </div>
                <div className="dash-room-pass">
                  <span>Room Password:</span>
                  <code>{showPassword ? currentPassword : "••••••••"}</code>
                  <button
                    className="pass-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide Password' : 'Show Password'}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                  <button
                    className="copy-btn small"
                    onClick={handleCopyPassword}
                    title="Copy Room Password"
                  >
                    {copiedPass ? "Copied" : "Copy"}
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
              <span className="alert-icon">!</span>
              {alert}
            </div>
          ))}
        </div>

        {/* Dashboard Body */}
        <main className="dash-body">
          {/* Room Lifetime Countdown & Session Controls */}
          <div className="session-countdown-bar">
            <div className="session-countdown-info">
              <span style={{ fontSize: '1.4rem' }}>
                
              </span>
              <div>
                <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                  {currentRoom?.status === 'ended' ? 'Session Status' : 'Session Lifetime Remaining'}
                </div>
                {currentRoom?.status === 'ended' ? (
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f87171' }}>
                    Focus Session Completed!
                  </div>
                ) : timeRemaining !== null ? (
                  <div className="session-clock-display">
                    {formatTime(timeRemaining)}
                  </div>
                ) : (
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#38bdf8' }}>
                    Unlimited Duration
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
              {isCreator && (
                <button
                  className="btn-edit-settings"
                  onClick={handleOpenSettingsModal}
                  title="Edit room configuration, websites, alerts, and time limits"
                >
                  ⚙️ Room Settings
                </button>
              )}
              <button
                className="btn-view-leaderboard"
                onClick={() => handleOpenLeaderboard()}
              >
                View Leaderboard
              </button>
              {currentRoom?.status !== 'ended' && (
                <button
                  className="btn-end-session"
                  onClick={handleEndSessionEarly}
                  title="End focus session now and finalize leaderboard"
                >
                  End Session Early
                </button>
              )}
            </div>
          </div>

          {/* Overall Room Aggregate Time Metrics */}
          <div className="overall-stats-grid">
            <div className="stat-card prod-stat">
              <div className="stat-card-label">Total Team Productive Time</div>
              <div className="stat-card-value text-green">{formatTime(totalTeamProdSec)}</div>
              <div className="stat-card-sub">{roomUsers.length} member{roomUsers.length === 1 ? '' : 's'} tracked</div>
            </div>

            <div className="stat-card dist-stat">
              <div className="stat-card-label">Total Team Distracting Time</div>
              <div className="stat-card-value text-red">{formatTime(totalTeamDistSec)}</div>
              <div className="stat-card-sub">
                Alert every {formatTime(currentRoom?.config?.distractionIntervalSec || 60)}
                {currentRoom?.config?.maxDistractionSec
                  ? ` · Kick limit: ${formatTime(currentRoom.config.maxDistractionSec)}`
                  : ' · No kick limit'}
              </div>
            </div>

            <div className="stat-card ratio-stat">
              <div className="stat-card-label">Focus Productivity Ratio</div>
              <div className="stat-card-value text-cyan">{teamRatio}%</div>
              <div className="stat-card-sub">Productive / Total Tracked Time</div>
            </div>
          </div>

          {/* Active Config Rules Ribbon */}
          {currentRoom?.config && (
            <div className="config-summary-strip">
              <div className="config-strip-section">
                <span className="strip-label productive-label">Productive Sites:</span>
                {currentRoom.config.productive?.map((site, i) => (
                  <span key={i} className="strip-chip productive-chip-sm">
                    {typeof site === 'string' ? site : site.url}
                  </span>
                ))}
              </div>
              <div className="config-strip-section">
                <span className="strip-label distracting-label">Distracting Sites:</span>
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
                          {user.currentUrl.length > 32 ? user.currentUrl.substring(0, 32) + '...' : user.currentUrl}
                        </div>
                      )}
                    </div>
                    <span className={`card-status-badge ${isDistracted ? 'distracted' : isProductive ? 'focused' : 'untracked'}`}>
                      {isDistracted
                        ? `Distracted (${user.consecutiveDistractingSec || 0}s)`
                        : isProductive
                        ? 'Productive'
                        : 'Untracked (Neutral)'}
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
                            ! Kick Limit: {formatTime(userDistSec)} / {formatTime(maxSec)}
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
                      {log.category === "productive" && "Productive"}
                      {log.category === "distracting" && "Distracting"}
                      {log.category === "untracked" && "Neutral"}
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
      {renderLeaderboardModal()}
      {renderSettingsModal()}
    </>
  );
}

export default App;
