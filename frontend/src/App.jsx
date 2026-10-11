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

// Sagu Cinematic Film Slideshow (Stitch Project 3314208514770998316)
const SLIDESHOW_IMAGES = [
  { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDvl8TQGzCeUWx4f28f8esc3p39tfFNmQOXY6ciUl4BHEzltxsk5FnwMl4l1l7Yoyh1vyMjwdPRvv5LH_kO6I4qZJtm7m_hxxtd7etzi45ebQOTq-WYZ7JaUxvGcmM25FYsfeL1DwfVi-UWTMJ51ys3hpNTi5n1bo2dwM4H6mL_Tu_VqTZi33iAYeE597tTHDd4BzBIB5d1rF1-p88UEz5MsnrAkC-ylTc9Y8JeS4gwi-n-hJWi4Gkzt3ApxOwGXeeu7g', title: 'Interstellar Focus' },
  { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDXqcpDLZwm6y7ElHC5AOeOZB2cETs7xW0LYVCuM9xnjgh8L1NEL39zgB8wDnr_yPvxP2DM5q62wAHQdw4aff-LbdIMywAPPht-wjeRdkLPJP62Q1BnpDPfG9FIOedQ8rOFD5XdhW52C7ref8kq7G1thrLpo9tlCq8ytWtXLn3eOblzdFRHZ5Hrj45VilJu8eiVJQaM786mZ0SX-9DvZSX9pYhvTUpUQrWPm2_6814eZb5FbbeiatS8D2hOgwXUwgs35w', title: 'Creed Discipline' },
  { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBwvDvA1C4iGuM0KV-yU6iTjWuee1jJIUwwPjCybxdc7UracTYzSI7HOAoo4uMiDVWKYWx1N7qwlX8nPh6PzkRNWU3ncnVhmaWI5S-OI0Vi8wOtPac1fkkhLWukwKquZvE2gT1GlIjr-S8l3ZZ9UjK7HHGGFflzXc53Sny7S-VmUk3Z43QgkYD1sW0yq3HjgRCsqXFL8nTXN2Gf_XOCqCEz3YPdboTdduev1sS-2NNbqmf0WzkbfTBa_sxrKXP0M3fq-Q', title: 'Ford v Ferrari Mastery' },
  { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBXKmrQOOICDcVJaetQRyFH1cb8vJ6-F0idNEsjenp87nEo85kwY7xQ_DiA07ib8Il7s700S9rZkV9E5XPM_1BmO3L6xDYEk8QA-e3HqbAq8Q2B-y7riavfx78LgbQV9wNv0kGy4nIj7nA_z_kcRWxAq0QJ6--s3wH8HqUi_ocqjGLOlPljQ1PzuY9ZHcHP87TvTRKhxn1pHL3DJBToClZWYRvt0IJGWash9DaOChdOshdX_sT2neJRRkpzCfK_vFlU_Q', title: 'Endurance Grit' },
  { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDBJRGdGweaTNijM20JImSHnomhTVuIAp00uHp2qx5yP_fwABTwK215YNbZJddSvyEqkG4SjOQpDNJB5KZkiqupX0D6i2SmiEsN7PDazz4o1VNcGgUDzWr9cqgIVIKwfU1WnqI4vmtvxia4p_asiLBL3jQjuizsFs0730OOXveG1MyMrchTF61aI_J2AYSyrTAi-v6OpJVJ3GGxDJ1keKCEYTsp4euVYd1uPToL0E8u2nONN8O0R-tyXKLi4307OSTrrA', title: 'Rocky Triumph' },
  { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCCFsoq-H3P3G78RXIjzBK3vBLjFI8iGmx2yH0CfAD-B28ksdMhh_hxVbDHZFmPwA8045kFK9pdheEfNajDRm7voTPwYJcLl4CvA5ZjBRLN2CvJpN71HvPX6Z1UT-rm4h5i3v7VurVf3ktMz79Q4rt7vVQSzTLY61PFck7QnSh-RASuli7akA00v06vPjJ5V9TApSt7vGLhNcA6RMMGMycR0Q5V23P4TwZMj_O8jgBCZhRyzxP38pbmqkRTv-xcD4UjCg', title: 'Pursuit of Purpose' }
];

function App() {
  // Navigation views: 'login' | 'hub' | 'create' | 'dashboard' | 'history'
  const [view, setView] = useState('login');

  // Slideshow & Dashboard Sub-tabs
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [dashboardTab, setDashboardTab] = useState('fleet'); // 'fleet' | 'policies' | 'status' | 'logs'

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlideIndex(prev => (prev + 1) % SLIDESHOW_IMAGES.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  // Theme state: 'dark' (default) | 'light'
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('sagu_theme') || 'dark';
  });

  // Cinematic Intro state
  const introVideoRef = useRef(null);
  const [showIntro, setShowIntro] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isIntroMuted, setIsIntroMuted] = useState(false);

  useEffect(() => {
    if (showIntro && introVideoRef.current) {
      introVideoRef.current.play().catch(() => {
        // Fallback to muted if browser blocks unmuted autoplay
        if (introVideoRef.current) {
          introVideoRef.current.muted = true;
          setIsIntroMuted(true);
          introVideoRef.current.play().catch(() => {});
        }
      });
    }
  }, [showIntro]);

  const handleSkipIntro = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      setShowIntro(false);
    }, 500);
  };

  const renderCinematicIntro = () => {
    if (!showIntro) return null;
    return (
      <div className={`sagu-intro-overlay ${isFadingOut ? 'fade-out' : ''}`}>
        <video
          ref={introVideoRef}
          className="sagu-intro-video"
          src="/Saguintro.mp4"
          autoPlay
          playsInline
          muted={isIntroMuted}
          onEnded={handleSkipIntro}
        />
        <div className="sagu-intro-bottom-bar">
          <button
            className="sagu-intro-mute-btn"
            onClick={(e) => {
              e.stopPropagation();
              if (introVideoRef.current) {
                introVideoRef.current.muted = !isIntroMuted;
              }
              setIsIntroMuted(prev => !prev);
            }}
            type="button"
            title={isIntroMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
              {isIntroMuted ? 'volume_off' : 'volume_up'}
            </span>
          </button>
          <button
            className="sagu-intro-skip-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleSkipIntro();
            }}
            type="button"
            id="skip-intro-btn"
          >
            <span>Skip Intro</span>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              fast_forward
            </span>
          </button>
        </div>
      </div>
    );
  };

  useEffect(() => {
    localStorage.setItem('sagu_theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const renderThemeToggle = () => (
    <button
      aria-label="Toggle theme"
      className="sagu-theme-toggle-btn"
      onClick={toggleTheme}
      type="button"
      title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
    >
      <span className="material-symbols-outlined" style={{ fontSize: '15px', color: theme === 'dark' ? '#ffb95f' : '#2563eb' }}>
        {theme === 'dark' ? 'dark_mode' : 'light_mode'}
      </span>
      <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'capitalize' }}>
        {theme === 'dark' ? 'Dark' : 'Light'}
      </span>
    </button>
  );

  const renderBackground = () => (
    <>
      {renderCinematicIntro()}
      <div aria-hidden="true" className="slideshow-viewport">
        {SLIDESHOW_IMAGES.map((img, i) => (
          <img
            key={i}
            src={img.url}
            alt={img.title}
            className={`slide-item ${i === currentSlideIndex ? 'active' : ''}`}
          />
        ))}
      </div>
      <div aria-hidden="true" className="slideshow-vignette" />
    </>
  );

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
        {renderBackground()}
        <div style={{ position: 'fixed', top: '1.25rem', right: '1.5rem', zIndex: 50 }}>
          {renderThemeToggle()}
        </div>
        <div className="sagu-auth-container">
          <div className="sagu-auth-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🚫</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ff7a73', margin: 0 }}>Permanently Removed</h2>
            <p style={{ color: '#d4d4d8', fontSize: '0.88rem', margin: '0.75rem 0' }}>
              {bannedFromRoom || 'You have been permanently removed from this room due to exceeding the maximum distraction time limit.'}
            </p>
            <p style={{ color: '#71717a', fontSize: '0.78rem', margin: '0 0 1.25rem' }}>
              You cannot re-enter this room. Ask the room creator to set up a new room if you want to try again.
            </p>
            <button
              className="btn btn-secondary"
              style={{ width: '100%', padding: '0.75rem' }}
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
        {renderBackground()}
        <div style={{ position: 'fixed', top: '1.25rem', right: '1.5rem', zIndex: 50 }}>
          {renderThemeToggle()}
        </div>
        <div className="sagu-auth-container">
          <div className="sagu-auth-card">
            {/* Sagu Brand & Logo */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '3.2rem', height: '3.2rem', borderRadius: '12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(78,222,163,0.3)', color: '#4edea3', fontSize: '1.4rem', fontWeight: 800, boxShadow: '0 0 20px rgba(78,222,163,0.25)', marginBottom: '0.75rem' }}>
                S
              </div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#ffffff', margin: 0, letterSpacing: '-0.02em' }}>Sagu</h1>
              <p style={{ color: '#9ba69f', fontSize: '0.84rem', marginTop: '0.35rem' }}>
                {authMode === 'login' && 'Deep Work Focus Workspace — Sign In'}
                {authMode === 'register' && 'Create your Sagu Focus Account'}
                {authMode === 'forgot' && 'Reset password via verified OTP'}
                {authMode === 'otp' && 'Enter the 6-digit OTP code sent to your email'}
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
        {renderBackground()}
        {/* Minimal Glass Header */}
        <header className="sagu-header">
          <div className="sagu-header-inner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div className="sagu-logo-badge">S</div>
                <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#ffffff', letterSpacing: '-0.02em' }}>Sagu</span>
              </div>
              <div style={{ height: '14px', width: '1px', background: 'rgba(255,255,255,0.15)' }} />
              <div className="sagu-live-pill">
                <span className="sagu-dot-live" />
                <span style={{ fontSize: '11px', color: '#a1a1aa' }}>Focus Hub: <span style={{ color: '#4edea3', fontWeight: 600 }}>Live</span></span>
                <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
                <span style={{ fontSize: '11px', color: '#a1a1aa' }}>{roomsList.length} Active Rooms</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              {renderThemeToggle()}
              {username && (
                <div className="sagu-avatar-pill" title={`Logged in as ${username}`}>
                  {username.slice(0, 2).toUpperCase()}
                </div>
              )}
              <button
                className="sagu-nav-btn"
                onClick={() => setView('history')}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <span>History</span>
              </button>
              <button
                className="sagu-nav-btn"
                style={{ color: '#ff7a73' }}
                onClick={() => { setUsername(''); setView('login'); setAuthMode('login'); setAuthPassword(''); setAuthIdentifier(''); }}
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <main className="sagu-canvas-container">
          {/* Hub Hero Header */}
          <div className="sagu-hero-row">
            <div>
              <div className="sagu-mode-pill">
                <span className="sagu-dot-live" style={{ width: '6px', height: '6px' }} />
                ZERO-TRUST WORKSPACE HUB
              </div>
              <h1 className="sagu-hero-title">
                Deep Work <strong>Focus Rooms</strong>
              </h1>
              <p className="sagu-hero-desc">
                Select an active focus sprint, configure custom productive & distracting policies, or launch your own room.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button
                className="btn btn-primary"
                style={{ padding: '0.75rem 1.4rem', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                onClick={() => setView('create')}
              >
                <span>+ Create Focus Room</span>
              </button>
            </div>
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
              <div className="sagu-resume-banner">
                <div>
                  <div style={{ fontWeight: 700, color: '#4edea3', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="sagu-dot-live" />
                    Session Running: "{roomName}"
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#a1a1aa', marginTop: '0.2rem' }}>
                    {endsAtVal
                      ? `Time Remaining: ${formatTime(Math.max(0, Math.round((endsAtVal - currentNow) / 1000)))}`
                      : "Unlimited session duration"}
                    {stored?.username ? ` · User: ${stored.username}` : ''}
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
                  onClick={() => {
                    if (isLiveRoom) {
                      setView('dashboard');
                    } else if (stored) {
                      handleJoin(stored.roomId, stored.password, stored.username);
                    }
                  }}
                >
                  Resume Dashboard →
                </button>
              </div>
            );
          })()}

          {/* Quick Join Enclosure */}
          <div className="sagu-hub-glass-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <span className="sagu-dot-live" />
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>Join a Focus Sprint</h2>
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
                <option value="">-- Select Focus Room --</option>
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
              <div className="join-error-msg" style={{ marginTop: '1rem' }}>
                ! {joinError}
              </div>
            )}
          </div>

          {/* Active Rooms Grid Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span className="sagu-dot-live" />
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                Active Workspaces ({roomsList.length})
              </h2>
            </div>
            <button
              className="btn btn-secondary"
              style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}
              onClick={fetchRooms}
              title="Refresh rooms list"
            >
              ↻ Refresh
            </button>
          </div>

          {loadingRooms && roomsList.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#a1a1aa' }}>
              Connecting to rooms gateway...
            </div>
          )}

          {roomsList.length === 0 && !loadingRooms && (
            <div className="sagu-hub-glass-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏢</div>
              <h3 style={{ color: '#ffffff', fontSize: '1.1rem', margin: '0 0 0.5rem' }}>No active rooms</h3>
              <p style={{ color: '#a1a1aa', fontSize: '0.85rem', margin: '0 0 1.25rem' }}>
                Create the first room and configure tracked websites to start deep work.
              </p>
              <button className="btn btn-primary" onClick={() => setView('create')}>
                + Create Focus Room
              </button>
            </div>
          )}

          {/* Rooms Grid */}
          <div className="sagu-rooms-grid">
            {roomsList.map((r) => {
              const isEnded = r.status === 'ended' || (r.endsAt && (r.endsAt - currentNow) <= 0);
              const liveLeft = r.endsAt ? Math.max(0, Math.round((r.endsAt - currentNow) / 1000)) : null;

              return (
                <div key={r.id} className="sagu-room-card">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#ffffff', margin: '0 0 0.35rem' }}>
                          {r.name}
                        </h3>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          {isEnded ? (
                            <span className="sagu-pill-badge sagu-pill-dist">Ended</span>
                          ) : liveLeft !== null ? (
                            <span className="sagu-pill-badge sagu-pill-prod">⏱ {formatTime(liveLeft)}</span>
                          ) : (
                            <span className="sagu-pill-badge sagu-pill-prod">Active</span>
                          )}
                          <span style={{ fontSize: '0.72rem', color: '#71717a' }}>
                            Alert: {formatTime(r.distractionIntervalSec || 60)}
                          </span>
                        </div>
                      </div>
                      <button
                        className="room-delete-btn"
                        onClick={(e) => handleDeleteRoom(r, e)}
                        title="Delete room (Requires Password)"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Rule Tags */}
                    <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <span className="sagu-pill-badge sagu-pill-prod">
                          {r.productiveCount} Productive
                        </span>
                        <span className="sagu-pill-badge sagu-pill-dist">
                          {r.distractingCount} Distracting
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                        {r.config?.productive?.slice(0, 2).map((p, i) => (
                          <span key={i} className="mini-url-tag tag-prod">
                            {typeof p === 'string' ? p : p.url}
                          </span>
                        ))}
                        {r.config?.distracting?.slice(0, 2).map((d, i) => (
                          <span key={i} className="mini-url-tag tag-dist">
                            {typeof d === 'string' ? d : d.url}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.85rem' }}>
                    <span style={{ fontSize: '0.78rem', color: '#a1a1aa' }}>
                      {r.userCount} online
                    </span>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {(r.status === 'ended' || (r.finalLeaderboard && r.finalLeaderboard.length > 0)) && (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem', color: '#ffb95f', borderColor: 'rgba(255,185,95,0.3)' }}
                          onClick={() => handleOpenLeaderboard(r)}
                        >
                          Results
                        </button>
                      )}
                      <button
                        className="btn btn-primary"
                        style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
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
                        {r.status === 'ended' ? 'Enter →' : 'Join →'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
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
        {renderBackground()}
        {/* Minimal Glass Header */}
        <header className="sagu-header">
          <div className="sagu-header-inner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div className="sagu-logo-badge">S</div>
                <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#ffffff', letterSpacing: '-0.02em' }}>Sagu</span>
              </div>
              <div style={{ height: '14px', width: '1px', background: 'rgba(255,255,255,0.15)' }} />
              <button
                className="sagu-nav-btn"
                onClick={() => setView('hub')}
              >
                ← Back to Hub
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              {renderThemeToggle()}
              {username && (
                <div className="sagu-avatar-pill" title={`Logged in as ${username}`}>
                  {username.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="sagu-canvas-container" style={{ maxWidth: '820px' }}>
          <div className="sagu-hero-row">
            <div>
              <div className="sagu-mode-pill">
                <span className="sagu-dot-live" style={{ width: '6px', height: '6px' }} />
                SESSION AUDIT LOG
              </div>
              <h1 className="sagu-hero-title">
                My Focus <strong>History</strong>
              </h1>
              {username && (
                <p className="sagu-hero-desc">
                  Recorded focus and distraction intervals for <strong style={{ color: '#4edea3' }}>{username}</strong>.
                </p>
              )}
            </div>
          </div>

          {loadingHistory ? (
            <div style={{ textAlign: 'center', color: '#a1a1aa', padding: '3rem' }}>
              Loading session history...
            </div>
          ) : !username ? (
            <div className="sagu-hub-glass-card" style={{ textAlign: 'center', color: '#a1a1aa', padding: '3rem' }}>
              ! Please sign in to view your history.
            </div>
          ) : historyData.length === 0 ? (
            <div className="sagu-hub-glass-card" style={{ textAlign: 'center', color: '#a1a1aa', padding: '3rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📋</div>
              <div style={{ fontWeight: 600, color: '#d4d4d8', fontSize: '1.05rem' }}>No sessions recorded yet</div>
              <div style={{ fontSize: '0.82rem', marginTop: '0.35rem', color: '#71717a' }}>
                Join a Focus Room to start logging deep work intervals.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[...historyData].reverse().map((entry, i) => {
                const duration = entry.joinedAt && entry.leftAt ? Math.round((entry.leftAt - entry.joinedAt) / 1000) : null;
                return (
                  <div key={i} className="sagu-history-row">
                    <div style={{ background: 'rgba(78, 222, 163, 0.15)', border: '1px solid rgba(78, 222, 163, 0.35)', borderRadius: '10px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#4edea3', fontSize: '0.85rem', flexShrink: 0 }}>
                      {historyData.length - i}
                    </div>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                        {entry.roomId || 'Focus Room'}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#a1a1aa', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <span><span style={{ color: '#4edea3' }}>Joined:</span> {fmt(entry.joinedAt)}</span>
                        <span><span style={{ color: '#ff7a73' }}>Left:</span> {entry.leftAt ? fmt(entry.leftAt) : <span style={{ color: '#ffb95f' }}>Still Active</span>}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {duration !== null ? (
                        <>
                          <div style={{ fontWeight: 600, color: '#4edea3', fontSize: '0.95rem', fontFamily: 'var(--font-mono)' }}>
                            {formatTime(duration)}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#71717a' }}>session duration</div>
                        </>
                      ) : (
                        <div style={{ fontWeight: 600, color: '#ffb95f', fontSize: '0.82rem' }}>
                          ● Active Now
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </>
    );
  }


  // ===============================================================
  // VIEW 2: CONFIGURE ROOM & TIME RULES
  // ===============================================================
  if (view === 'create') {
    return (
      <>
        {renderBackground()}
        {/* Minimal Glass Header */}
        <header className="sagu-header">
          <div className="sagu-header-inner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div className="sagu-logo-badge">S</div>
                <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#ffffff', letterSpacing: '-0.02em' }}>Sagu</span>
              </div>
              <div style={{ height: '14px', width: '1px', background: 'rgba(255,255,255,0.15)' }} />
              <button
                className="sagu-nav-btn"
                onClick={() => setView('hub')}
              >
                ← Back to Hub
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              {renderThemeToggle()}
              {username && (
                <div className="sagu-avatar-pill" title={`Logged in as ${username}`}>
                  {username.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="sagu-canvas-container" style={{ maxWidth: '820px' }}>
          <div className="sagu-setup-card">
            <div>
              <div className="sagu-mode-pill" style={{ marginBottom: '0.5rem' }}>
                <span className="sagu-dot-live" style={{ width: '6px', height: '6px' }} />
                WORKSPACE POLICY GENERATOR
              </div>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>Create Focus Room</h1>
              <p style={{ color: '#a1a1aa', fontSize: '0.84rem', marginTop: '0.35rem' }}>
                Configure monitored websites, distraction alert frequencies, and kick-out enforcement.
              </p>
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
        </main>
      </>
    );
  }

  // ===============================================================
  // VIEW 3: LIVE TIME-TRACKING DASHBOARD (Sagu Unified Bar Workspace)
  // ===============================================================
  return (
    <>
      {renderBackground()}

      {/* Minimal Sagu Glass Header */}
      <header className="sagu-header">
        <div className="sagu-header-inner">
          {/* Brand & Room Status */}
          <div className="sagu-header-left">
            <div className="sagu-brand-link" onClick={handleLeaveRoom} title="Exit to Hub">
              <div className="sagu-logo-badge">S</div>
              <span className="sagu-brand-name">Sagu</span>
            </div>

            <div className="sagu-header-divider" />

            {/* Room Live Pill */}
            <div className="sagu-live-pill">
              <span className="sagu-dot-live" />
              <span className="sagu-live-tag">Live</span>
              <span className="sagu-pill-sep">•</span>
              <button
                className="sagu-pill-btn"
                onClick={() => {
                  navigator.clipboard.writeText(currentRoom?.id || '');
                  alert(`Copied Room ID: ${currentRoom?.id || ''}`);
                }}
                title="Click to copy Room ID"
              >
                <span>{currentRoom?.id || 'room-id'}</span>
                <span className="material-symbols-outlined" style={{ fontSize: '12px', color: '#71717a' }}>content_copy</span>
              </button>
              <span className="sagu-pill-sep">•</span>
              <span style={{ fontSize: '11px', color: '#a1a1aa', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                Pass: <code style={{ color: '#4edea3', fontFamily: 'var(--font-mono)' }}>{showPassword ? currentPassword : "••••"}</code>
              </span>
              <button
                className="sagu-pill-subbtn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide Password' : 'Show Password'}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
              <button
                className="sagu-pill-subbtn"
                onClick={handleCopyPassword}
                title="Copy Password"
              >
                {copiedPass ? "✓" : "Copy"}
              </button>
              <span className="sagu-pill-sep">•</span>
              <span style={{ fontSize: '11px', color: '#a1a1aa' }}>
                {roomUsers.length} Member{roomUsers.length === 1 ? '' : 's'}
              </span>
              {isCreator && (
                <>
                  <span className="sagu-pill-sep">•</span>
                  <span className="sagu-creator-badge">
                    Host (Creator)
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Nav Links & Action Utilities */}
          <div className="sagu-header-right">
            {renderThemeToggle()}
            {isCreator && (
              <button
                className="btn-edit-settings"
                onClick={handleOpenSettingsModal}
                title="Configure room websites, recurring alert intervals, and kickout limits"
              >
                <span>⚙️</span>
                <span>Room Settings</span>
              </button>
            )}

            <button
              className="btn-view-leaderboard"
              onClick={() => handleOpenLeaderboard()}
              title="View Leaderboard"
            >
              <span>🏆</span>
              <span>Leaderboard</span>
            </button>

            {currentRoom?.status !== 'ended' && (
              <button
                className="btn-end-session"
                onClick={handleEndSessionEarly}
                title="End focus session now and finalize leaderboard"
              >
                <span>⏹️</span>
                <span>End Session</span>
              </button>
            )}

            <button
              className="sagu-nav-btn sagu-exit-btn"
              onClick={handleLeaveRoom}
              title="Exit to Rooms Hub"
            >
              ← Exit to Hub
            </button>

            <div className="sagu-avatar-pill" title={`Logged in as ${username}`}>
              {(username || 'SG').slice(0, 2).toUpperCase()}
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

      {/* Main Content Canvas */}
      <main className="sagu-canvas-container">
        {/* Hero Statement */}
        <section className="sagu-hero-row">
          <div>
            <div className="sagu-mode-pill">
              <span className="sagu-dot-live" style={{ width: '6px', height: '6px' }} />
              FOCUS MODE ACTIVE
            </div>
            <h1 className="sagu-hero-title">
              Deep Work <strong>{currentRoom?.name || 'Session'}</strong>
            </h1>
            <p className="sagu-hero-desc">
              See live focus levels across your team, keep distractions away, and build momentum together.
            </p>
          </div>

          <div className="sagu-hero-cards">
            {/* Live Score Highlight Block */}
            <div className="sagu-score-card">
              <div style={{ position: 'relative', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg style={{ width: '44px', height: '44px', transform: 'rotate(-90deg)' }} viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#4edea3"
                    strokeDasharray={`${teamRatio}, 100`}
                    strokeLinecap="round"
                    strokeWidth="3"
                  />
                </svg>
                <span style={{ position: 'absolute', fontSize: '10px', fontWeight: 700, color: '#ffffff' }}>
                  {teamRatio}%
                </span>
              </div>
              <div>
                <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#a1a1aa', fontWeight: 600 }}>
                  Team Score
                </div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '2px' }}>
                  <span>{teamRatio >= 75 ? 'High Focus' : teamRatio >= 50 ? 'Moderate' : 'Needs Focus'}</span>
                  <span style={{ fontSize: '10px', color: '#4edea3' }}>{teamRatio}%</span>
                </div>
              </div>
            </div>

            {/* Zero-Trust Sync Card */}
            <div className="sagu-score-card">
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(78,222,163,0.12)', border: '1px solid rgba(78,222,163,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4edea3', flexShrink: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>extension</span>
              </div>
              <div>
                <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#a1a1aa', fontWeight: 600 }}>
                  Zero-Trust Sync
                </div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '2px' }}>
                  <span className="sagu-dot-live" style={{ width: '6px', height: '6px' }} />
                  <span>Extension v2.4 Active</span>
                </div>
              </div>
              <button
                onClick={() => setDashboardTab('status')}
                style={{ background: 'none', border: 'none', color: '#4edea3', fontSize: '11px', cursor: 'pointer', paddingLeft: '0.5rem', borderLeft: '1px solid rgba(255,255,255,0.1)' }}
              >
                Inspect
              </button>
            </div>
          </div>
        </section>

        {/* UNIFIED METRIC BAR: One single continuous horizontal bar with frosted obsidian blur & subtle dividers */}
        <section className="sagu-metric-bar">
          <div className="sagu-metric-grid">
            {/* Metric 1: Focus Score */}
            <div className="sagu-metric-col">
              <div>
                <div className="sagu-metric-header">
                  <span>FOCUS SCORE</span>
                  <span style={{ color: '#4edea3' }}>{teamRatio >= 70 ? 'High' : 'Active'}</span>
                </div>
                <div className="sagu-metric-val">{teamRatio}%</div>
                <p className="sagu-metric-sub">Average score across active members</p>
              </div>
              <div className="sagu-metric-progress">
                <div className="sagu-progress-bar" style={{ width: `${teamRatio}%` }} />
              </div>
            </div>

            {/* Metric 2: Monitored Tabs / Rules */}
            <div className="sagu-metric-col">
              <div>
                <div className="sagu-metric-header">
                  <span>MONITORED SITES</span>
                  <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'rgba(255,255,255,0.5)' }}>tab</span>
                </div>
                <div className="sagu-metric-val">
                  {(currentRoom?.config?.productive?.length || 0) + (currentRoom?.config?.distracting?.length || 0)}
                </div>
                <p className="sagu-metric-sub">
                  {currentRoom?.config?.productive?.length || 0} productive · {currentRoom?.config?.distracting?.length || 0} distracting
                </p>
              </div>
              <div style={{ fontSize: '10px', color: '#4edea3', marginTop: '0.75rem' }}>
                Strict Rule Policy Active
              </div>
            </div>

            {/* Metric 3: Focus Time & Lifetime Countdown */}
            <div className="sagu-metric-col">
              <div>
                <div className="sagu-metric-header">
                  <span>
                    {currentRoom?.status === 'ended' ? 'STATUS' : timeRemaining !== null ? 'TIME REMAINING' : 'TEAM FOCUS TIME'}
                  </span>
                  <span style={{ color: '#ffb95f', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>bolt</span>Flow
                  </span>
                </div>
                <div className="sagu-metric-val">
                  {currentRoom?.status === 'ended' ? (
                    <span style={{ color: '#ff7a73' }}>Ended</span>
                  ) : timeRemaining !== null ? (
                    formatTime(timeRemaining)
                  ) : (
                    formatTime(totalTeamProdSec)
                  )}
                </div>
                <p className="sagu-metric-sub">
                  Total productive: {formatTime(totalTeamProdSec)}
                </p>
              </div>
              <div style={{ fontSize: '10px', color: '#a1a1aa', marginTop: '0.75rem' }}>
                {timeRemaining !== null ? 'Automatic session finalization' : 'Unlimited duration sprint'}
              </div>
            </div>

            {/* Metric 4: Distraction Breaches & Limits */}
            <div className="sagu-metric-col">
              <div>
                <div className="sagu-metric-header">
                  <span>DISTRACTION LIMITS</span>
                  <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#ff7a73' }}>warning</span>
                </div>
                <div className="sagu-metric-val" style={{ color: totalTeamDistSec > 0 ? '#ff7a73' : '#ffffff' }}>
                  {formatTime(totalTeamDistSec)}
                </div>
                <p className="sagu-metric-sub">
                  Alert every {formatTime(currentRoom?.config?.distractionIntervalSec || 60)}
                </p>
              </div>
              <div style={{ fontSize: '10px', color: currentRoom?.config?.maxDistractionSec ? '#ffb95f' : '#4edea3', marginTop: '0.75rem' }}>
                {currentRoom?.config?.maxDistractionSec
                  ? `Kick limit: ${formatTime(currentRoom.config.maxDistractionSec)}`
                  : 'No kick limit (Unlimited)'}
              </div>
            </div>
          </div>
        </section>

        {/* UNIFIED LOWER SECTION BAR: Cohesive frosted obsidian enclosure for Tabs Navigation AND Content Cards */}
        <section className="sagu-panel-enclosure">
          {/* Top Controls inside unified enclosure */}
          <div className="sagu-panel-top">
            {/* Segmented Filter Pills */}
            <div className="sagu-segmented-tabs">
              <button
                className={`sagu-tab-item ${dashboardTab === 'fleet' ? 'active' : ''}`}
                onClick={() => setDashboardTab('fleet')}
                type="button"
              >
                Team Members ({roomUsers.length})
              </button>
              <button
                className={`sagu-tab-item ${dashboardTab === 'policies' ? 'active' : ''}`}
                onClick={() => setDashboardTab('policies')}
                type="button"
              >
                Allowed Sites
              </button>
              <button
                className={`sagu-tab-item ${dashboardTab === 'status' ? 'active' : ''}`}
                onClick={() => setDashboardTab('status')}
                type="button"
              >
                Connection Status
              </button>
              <button
                className={`sagu-tab-item ${dashboardTab === 'logs' ? 'active' : ''}`}
                onClick={() => setDashboardTab('logs')}
                type="button"
              >
                Live Feed ({currentRoom?.logs?.length || 0})
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '10px', color: '#a1a1aa' }}>
              <span className="sagu-dot-live" style={{ width: '6px', height: '6px' }} />
              <span>Live updates on (WebSocket sync)</span>
            </div>
          </div>

          {/* TAB 1: FLEET (Team Members Grid & Detailed Breakdown) */}
          {dashboardTab === 'fleet' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Member Peer Cards */}
              <div className="sagu-peers-grid">
                {roomUsers.map((user, index) => {
                  const userProdSec = user.productiveSec || 0;
                  const userDistSec = user.distractingSec || 0;
                  const userUntrackedSec = user.untrackedSec || 0;
                  const userTotalSec = userProdSec + userDistSec;
                  const userRatio = userTotalSec > 0 ? Math.round((userProdSec / userTotalSec) * 100) : 100;
                  const isDistracted = user.currentCategory === 'distracting';
                  const isProductive = user.currentCategory === 'productive';
                  const isSelf = user.username === username;

                  return (
                    <div
                      key={user.id || index}
                      className={`sagu-peer-card ${isDistracted ? 'is-distracted' : ''}`}
                    >
                      <div>
                        {/* Header: Avatar, Name, Score */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <div className={`sagu-peer-avatar ${isDistracted ? 'avatar-dist' : isProductive ? 'avatar-prod' : 'avatar-neutral'}`}>
                              {(user.username || 'U').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span>{user.username}</span>
                                {isSelf && (
                                  <span style={{ fontSize: '9px', padding: '0.1rem 0.35rem', borderRadius: '4px', background: 'rgba(255,255,255,0.1)', color: '#4edea3', fontWeight: 600 }}>
                                    You
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '10px', color: '#71717a' }}>
                                {isProductive ? 'Focusing' : isDistracted ? 'Distracted' : 'Neutral Tab'}
                              </div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: isDistracted ? '#ff7a73' : '#4edea3', fontFamily: 'var(--font-mono)' }}>
                              {userRatio}%
                            </div>
                          </div>
                        </div>

                        {/* Current Tab Preview */}
                        <div style={{ marginTop: '0.85rem' }}>
                          <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#71717a', fontWeight: 600 }}>
                            {isDistracted ? 'Off-Task Tab' : 'Current Tab'}
                          </div>
                          <div
                            className="sagu-url-preview"
                            style={{ color: isDistracted ? '#ff7a73' : '#d4d4d8' }}
                            title={user.currentUrl || 'Idle (no tab reported)'}
                          >
                            {user.currentUrl || 'Idle / Browsing'}
                          </div>
                        </div>

                        {/* Individual Time Pills (Productive, Distracting, Neutral) */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem', marginTop: '0.75rem' }}>
                          <div style={{ background: 'rgba(78,222,163,0.08)', borderRadius: '6px', padding: '0.35rem 0.45rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '8px', color: '#4edea3', fontWeight: 700 }}>PROD</div>
                            <div style={{ fontSize: '11px', color: '#ffffff', fontFamily: 'var(--font-mono)' }}>{formatClock(userProdSec)}</div>
                          </div>
                          <div style={{ background: 'rgba(239,68,68,0.08)', borderRadius: '6px', padding: '0.35rem 0.45rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '8px', color: '#ff7a73', fontWeight: 700 }}>DIST</div>
                            <div style={{ fontSize: '11px', color: '#ffffff', fontFamily: 'var(--font-mono)' }}>{formatClock(userDistSec)}</div>
                          </div>
                          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '0.35rem 0.45rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '8px', color: '#a1a1aa', fontWeight: 700 }}>NEUT</div>
                            <div style={{ fontSize: '11px', color: '#ffffff', fontFamily: 'var(--font-mono)' }}>{formatClock(userUntrackedSec)}</div>
                          </div>
                        </div>

                        {/* Kick Limit Bar if configured */}
                        {currentRoom?.config?.maxDistractionSec > 0 && (() => {
                          const maxSec = currentRoom.config.maxDistractionSec;
                          const usedPct = Math.min(100, Math.round((userDistSec / maxSec) * 100));
                          const danger = usedPct >= 80 ? '#ff7a73' : usedPct >= 50 ? '#ffb95f' : '#4edea3';
                          return (
                            <div style={{ marginTop: '0.65rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#71717a', marginBottom: '2px' }}>
                                <span>Kick: {formatTime(userDistSec)} / {formatTime(maxSec)}</span>
                                <span style={{ color: danger, fontWeight: 700 }}>{usedPct}%</span>
                              </div>
                              <div style={{ height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '9999px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${usedPct}%`, background: danger, transition: 'width 0.3s' }} />
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Card Bottom: Status Pill */}
                      <div style={{ paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: isDistracted ? '#ff7a73' : isProductive ? '#4edea3' : '#a1a1aa' }}>
                          <span className="sagu-dot-live" style={{ width: '5px', height: '5px', background: isDistracted ? '#ff7a73' : '#4edea3' }} />
                          {isDistracted ? `Distracted (${user.consecutiveDistractingSec || 0}s)` : isProductive ? 'In The Zone' : 'Neutral Site'}
                        </span>
                        <span style={{ color: '#71717a' }}>{userRatio}% Score</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Empty state if no peers connected */}
              {roomUsers.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                  <div className="radar-container" style={{ margin: '0 auto 1.5rem' }}>
                    <div className="radar-ring radar-ring-1" />
                    <div className="radar-ring radar-ring-2" />
                    <div className="radar-ring radar-ring-3" />
                    <div className="radar-sweep" />
                    <div className="radar-center-dot" />
                  </div>
                  <h3 style={{ color: '#ffffff', fontSize: '1.1rem', margin: '0 0 0.5rem' }}>Waiting for Chrome Extension sync...</h3>
                  <p style={{ color: '#a1a1aa', fontSize: '0.85rem', margin: '0' }}>
                    Connect the Chrome Extension with Username <strong style={{ color: '#4edea3' }}>{username}</strong> and Room Password <strong style={{ color: '#4edea3' }}>{currentPassword}</strong>.
                  </p>
                </div>
              )}

              {/* Detailed Breakdown Table */}
              {roomUsers.length > 0 && (
                <div style={{ marginTop: '0.5rem', overflowX: 'auto' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ffffff', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="sagu-dot-live" style={{ width: '6px', height: '6px' }} />
                    Individual Member Breakdown Table
                  </div>
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
                            <td className="table-username">
                              <strong>{u.username}</strong>
                              {u.username === username && (
                                <span style={{ marginLeft: '0.4rem', fontSize: '9px', padding: '1px 5px', borderRadius: '4px', background: 'rgba(78,222,163,0.15)', color: '#4edea3' }}>
                                  You
                                </span>
                              )}
                            </td>
                            <td className="table-url" title={u.currentUrl || 'Idle'}>
                              {u.currentUrl ? (u.currentUrl.length > 32 ? u.currentUrl.substring(0, 32) + '...' : u.currentUrl) : 'Idle'}
                            </td>
                            <td className="text-green table-mono">{formatTime(prod)}</td>
                            <td className="text-red table-mono">{formatTime(dist)}</td>
                            <td className="table-mono" style={{ opacity: 0.6 }}>{formatTime(untracked)}</td>
                            <td>
                              <span className="ratio-tag">{ratio}%</span>
                            </td>
                            <td>
                              <span className={`sagu-pill-badge ${isDist ? 'sagu-pill-dist' : 'sagu-pill-prod'}`}>
                                {isDist ? 'Distracted' : 'Focused'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: POLICIES (Allowed & Distracting Sites) */}
          {dashboardTab === 'policies' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ fontSize: '0.82rem', color: '#a1a1aa' }}>
                  Room Policy: <strong style={{ color: '#ffffff' }}>Strict Engineering Zero-Trust</strong>
                </div>
                {isCreator && (
                  <button
                    className="btn btn-primary"
                    style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}
                    onClick={handleOpenSettingsModal}
                  >
                    ⚙️ Edit Rules & Alert Interval
                  </button>
                )}
              </div>

              {/* Productive Rules Section */}
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#4edea3', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
                <span className="sagu-dot-live" style={{ width: '6px', height: '6px' }} />
                Allowed & Productive Websites (+1.5 / min)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {currentRoom?.config?.productive?.map((site, idx) => {
                  const urlStr = typeof site === 'string' ? site : site.url;
                  return (
                    <div key={idx} className="sagu-policy-item">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <span className="sagu-dot-live" style={{ width: '7px', height: '7px' }} />
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ffffff' }}>Productive Website Domain</div>
                          <div style={{ fontSize: '0.75rem', color: '#a1a1aa', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>{urlStr}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="sagu-pill-badge sagu-pill-prod">+1.5 / min focus</span>
                        <span style={{ fontSize: '10px', color: '#71717a' }}>Tracked</span>
                      </div>
                    </div>
                  );
                })}
                {(!currentRoom?.config?.productive || currentRoom.config.productive.length === 0) && (
                  <div style={{ color: '#71717a', fontSize: '0.82rem', padding: '1rem' }}>No productive websites added.</div>
                )}
              </div>

              {/* Distracting Rules Section */}
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ff7a73', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '1rem' }}>
                <span className="sagu-dot-live" style={{ width: '6px', height: '6px', background: '#ff7a73' }} />
                Distracting Websites (-5.0 / min Breach Alert)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {currentRoom?.config?.distracting?.map((site, idx) => {
                  const urlStr = typeof site === 'string' ? site : site.url;
                  return (
                    <div key={idx} className="sagu-policy-item" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <span className="sagu-dot-live" style={{ width: '7px', height: '7px', background: '#ff7a73' }} />
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ffffff' }}>Distracting Website Domain</div>
                          <div style={{ fontSize: '0.75rem', color: '#ff7a73', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>{urlStr}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="sagu-pill-badge sagu-pill-dist">Breach Alert Popup</span>
                        <span style={{ fontSize: '10px', color: '#71717a' }}>Enforced</span>
                      </div>
                    </div>
                  );
                })}
                {(!currentRoom?.config?.distracting || currentRoom.config.distracting.length === 0) && (
                  <div style={{ color: '#71717a', fontSize: '0.82rem', padding: '1rem' }}>No distracting websites added.</div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: STATUS (Connection Status & Extension) */}
          {dashboardTab === 'status' && (
            <div className="sagu-status-grid">
              {/* Socket.io Live Gateway Card */}
              <div style={{ padding: '1.25rem', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#4edea3' }}>bolt</span>
                    Socket.io Live Gateway
                  </div>
                  <span className="sagu-pill-badge sagu-pill-prod">Connected</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                  <div className="sagu-status-metric-cell">
                    <div style={{ fontSize: '10px', color: '#71717a' }}>Websocket Latency</div>
                    <div style={{ fontSize: '0.82rem', color: '#ffffff', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>24ms (wss://)</div>
                  </div>
                  <div className="sagu-status-metric-cell">
                    <div style={{ fontSize: '10px', color: '#71717a' }}>Room Channel</div>
                    <div style={{ fontSize: '0.82rem', color: '#4edea3', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>{currentRoom?.id || 'room-id'}</div>
                  </div>
                  <div className="sagu-status-metric-cell">
                    <div style={{ fontSize: '10px', color: '#71717a' }}>Heartbeat Ping</div>
                    <div style={{ fontSize: '0.82rem', color: '#ffffff', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>Every 3.0s</div>
                  </div>
                  <div className="sagu-status-metric-cell">
                    <div style={{ fontSize: '10px', color: '#71717a' }}>Protocol State</div>
                    <div style={{ fontSize: '0.82rem', color: '#4edea3', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>Zero-Trust Sync</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem' }}
                    onClick={() => {
                      socket.emit('reconnect-sync');
                      alert('Re-synced socket connection.');
                    }}
                  >
                    Re-sync Socket
                  </button>
                </div>
              </div>

              {/* Chrome Extension Companion Card */}
              <div style={{ padding: '1.25rem', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#4edea3' }}>extension</span>
                      Chrome Extension Companion
                    </div>
                    <span className="sagu-pill-badge sagu-pill-prod">v2.4 Installed</span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#a1a1aa', lineHeight: 1.5, margin: 0 }}>
                    Monitors active browser tab URL hashes with zero cookie extraction and instant breach notifications.
                  </p>
                </div>

                <div style={{ padding: '0.65rem 0.85rem', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.78rem', color: '#d4d4d8' }}>Manifest V3 Zero-Trust Daemon</span>
                  <span style={{ fontSize: '0.75rem', color: '#4edea3', fontWeight: 600 }}>Running</span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, padding: '0.45rem', fontSize: '0.78rem' }}
                    onClick={() => alert(`Companion Extension Active. Pair with Room Password: ${currentPassword}`)}
                  >
                    Verify Companion
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: LOGS (Live Tab Activity & Alert History) */}
          {dashboardTab === 'logs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ffffff', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="sagu-dot-live" style={{ width: '6px', height: '6px' }} />
                Real-Time Tab Navigation & Breach Log
              </div>

              {(!currentRoom?.logs || currentRoom.logs.length === 0) ? (
                <div style={{ textAlign: 'center', color: '#71717a', padding: '2rem', fontSize: '0.85rem' }}>
                  No tab activity logged yet. Open tabs tracked by the companion extension.
                </div>
              ) : (
                <div className="sagu-log-list">
                  {currentRoom.logs.map((log) => (
                    <div
                      key={log.id}
                      className={`sagu-log-row ${log.category === 'distracting' ? 'distracting' : log.category === 'productive' ? 'productive' : ''}`}
                    >
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: '#71717a' }}>
                        {log.timestamp}
                      </span>
                      <strong style={{ color: '#ffffff', fontSize: '0.8rem' }}>{log.username}</strong>
                      <span
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: log.category === 'distracting' ? '#ff7a73' : log.category === 'productive' ? '#4edea3' : '#a1a1aa', flex: 1, minWidth: '150px' }}
                        title={log.url}
                      >
                        {log.url}
                      </span>
                      <span className={`sagu-pill-badge ${log.category === 'distracting' ? 'sagu-pill-dist' : log.category === 'productive' ? 'sagu-pill-prod' : 'sagu-pill-neutral'}`}>
                        {log.category === 'productive' && 'Productive'}
                        {log.category === 'distracting' && 'Distracting'}
                        {log.category === 'untracked' && 'Neutral'}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#71717a' }}>{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* Clean Dark Glass Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '1.25rem 1.5rem', fontSize: '11px', color: '#71717a', backdropFilter: 'blur(20px)', background: 'rgba(0,0,0,0.7)', position: 'relative', zIndex: 10 }}>
        <div style={{ maxWidth: '1140px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#4edea3', fontWeight: 600 }}>Sagu</span>
            <span>•</span>
            <span>Simple & Focused Team Workspace</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#d4d4d8' }}>
              <span className="sagu-dot-live" style={{ width: '5px', height: '5px' }} />
              All Systems Operational
            </span>
          </div>
        </div>
      </footer>

      {renderLeaderboardModal()}
      {renderSettingsModal()}
    </>
  );
}

export default App;
