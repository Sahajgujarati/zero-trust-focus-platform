// Helper to reliably get active session from storage (with backend auto-sync fallback)
async function getSession() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['username', 'roomId', 'serverUrl'], async (result) => {
      const serverUrl = (result.serverUrl || 'http://localhost:4000').trim().replace(/\/$/, '');
      if (result.username && result.roomId) {
        resolve({
          username: result.username.trim(),
          roomId: result.roomId.trim(),
          serverUrl: serverUrl
        });
      } else if (result.username) {
        // If username exists but roomId is missing, auto-fetch user's active room
        try {
          const syncRes = await fetch(`${serverUrl}/api/users/${encodeURIComponent(result.username.trim())}/active-room`);
          if (syncRes.ok) {
            const syncData = await syncRes.json();
            if (syncData.success && syncData.roomId) {
              console.log("[Extension] Auto-synced active room:", syncData.roomId);
              chrome.storage.local.set({ roomId: syncData.roomId });
              resolve({
                username: result.username.trim(),
                roomId: syncData.roomId,
                serverUrl: serverUrl
              });
              return;
            }
          }
        } catch (e) {}
        resolve(null);
      } else {
        resolve(null);
      }
    });
  });
}

// Check if URL is an internal browser page that should not be tracked
function isInternalUrl(url) {
  if (!url) return true;
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('about:') ||
    url.startsWith('edge://') ||
    url.startsWith('brave://') ||
    url.startsWith('devtools://') ||
    url.startsWith('view-source:')
  );
}

// Resilient tab query helper that works reliably inside Manifest V3 service workers
async function getActiveTab() {
  try {
    // 1. Try finding active tab in the currently focused window
    const focusedTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (focusedTabs && focusedTabs[0]?.url) {
      return focusedTabs[0];
    }

    // 2. Fallback to any active tab across windows
    const allActive = await chrome.tabs.query({ active: true });
    if (allActive && allActive.length > 0) {
      const valid = allActive.find(t => t.url && !isInternalUrl(t.url));
      return valid || allActive[0];
    }
  } catch (err) {
    console.debug("[Extension] getActiveTab error:", err);
  }
  return null;
}

// Check active tab immediately upon connecting in popup
chrome.runtime.onMessage.addListener(async (message) => {
  if (message.type === 'CONNECT') {
    isKickedOut = false;
    console.log("[Extension] Connected session:", message.username, "Room:", message.roomId);
    triggerActiveTabSync();
  }
});

// Reset kick state and trigger sync whenever storage credentials change
if (chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.roomId || changes.username)) {
      isKickedOut = false;
      triggerActiveTabSync();
    }
  });
}

// Tab switch listener
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab?.url && !isInternalUrl(tab.url)) {
      sendTabActivity(tab.url, 1);
      return;
    }
  } catch (e) {}
  triggerActiveTabSync();
});

// Tab URL update listener
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const targetUrl = changeInfo.url || tab?.url;
  if (tab?.active && targetUrl && !isInternalUrl(targetUrl)) {
    sendTabActivity(targetUrl, 1);
  }
});

// Tab removed / closed listener: immediately sync to next active tab
chrome.tabs.onRemoved.addListener(() => {
  triggerActiveTabSync();
});

// Tab created listener
chrome.tabs.onCreated.addListener(() => {
  triggerActiveTabSync();
});

// Window focus changed listener
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    triggerActiveTabSync();
  }
});

async function triggerActiveTabSync() {
  const tab = await getActiveTab();
  if (tab?.url && !isInternalUrl(tab.url)) {
    sendTabActivity(tab.url, 1);
  }
}

// ── 1-Second Continuous Heartbeat Timer for Real-Time Time Tracking ──
setInterval(async () => {
  const tab = await getActiveTab();
  if (tab?.url && !isInternalUrl(tab.url)) {
    sendTabActivity(tab.url, 1);
  }
}, 1000);

// Keep-alive alarm to prevent MV3 service worker from sleeping
if (chrome.alarms) {
  chrome.alarms.create('heartbeat_keepalive', { periodInMinutes: 0.1 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'heartbeat_keepalive') {
      triggerActiveTabSync();
    }
  });
}

let lastRequestTime = 0;
let isKickedOut = false; // Set to true once user is permanently banned — stops all heartbeats


// Play alert sound via popup (if open) and offscreen document (if background)
async function triggerAlertSound() {
  try {
    const prefs = await new Promise((r) => {
      chrome.storage.local.get(['soundChoice', 'soundVolume', 'customSoundData'], r);
    });
    const choice = prefs.soundChoice || 'alarm';
    if (choice === 'none') return;

    // 1. Notify popup in case it is open
    chrome.runtime.sendMessage({ type: 'ALERT' }).catch(() => {});

    // 2. Play via offscreen document so it plays even when popup is closed
    if (chrome.offscreen) {
      let hasDoc = false;
      if (chrome.offscreen.hasDocument) {
        hasDoc = await chrome.offscreen.hasDocument();
      }
      if (!hasDoc) {
        await chrome.offscreen.createDocument({
          url: 'offscreen.html',
          reasons: ['AUDIO_PLAYBACK'],
          justification: 'Play distraction alert sound'
        }).catch(() => {});
      }
      chrome.runtime.sendMessage({
        type: 'OFFSCREEN_PLAY_SOUND',
        choice: choice,
        volume: prefs.soundVolume !== undefined ? prefs.soundVolume : 70,
        customSoundData: prefs.customSoundData
      }).catch(() => {});
    }
  } catch (e) {
    console.debug('[Extension] Sound trigger error:', e);
  }
}

async function sendTabActivity(url, elapsedSec = 1) {
  if (!url) return;

  // Ignore browser internal pages
  if (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('about:') ||
    url.startsWith('edge://') ||
    url.startsWith('brave://') ||
    url.startsWith('devtools://')
  ) {
    return;
  }

  const session = await getSession();
  if (!session) {
    return;
  }

  // If user was kicked out, stop sending any activity
  if (isKickedOut) {
    return;
  }

  try {
    const endpoint = `${session.serverUrl}/api/activity`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        roomId: session.roomId,
        password: session.roomId,
        username: session.username,
        url: url,
        elapsedSec: elapsedSec
      })
    });

    if (response.ok) {
      const data = await response.json();

      // Successfully connected: clear kicked state
      isKickedOut = false;

      // Auto-update roomId in storage if server mapped to a different active room
      if (data.activeRoomId && data.activeRoomId !== session.roomId) {
        console.log('[Extension] Updating roomId from server response:', data.activeRoomId);
        chrome.storage.local.set({ roomId: data.activeRoomId });
      }

      // Trigger notification if server flagged alert (initial or recurring interval)
      if (data.shouldAlert) {
        const notifId = 'distraction_' + Date.now();
        chrome.notifications.create(notifId, {
          type: 'basic',
          iconUrl: 'icon128.png',
          title: data.alertType === 'recurring' ? '⏰ Distraction Reminder!' : data.alertType === 'warning' ? '⚠️ Kick Warning!' : '🚨 Distraction Detected!',
          message: data.alertMessage || 'Please get back to your productive focus task.',
          priority: 2
        });
        triggerAlertSound();
      }
    } else if (response.status === 404) {
      // Room not found (e.g. room was deleted or changed) — auto-sync user's active room
      try {
        const syncRes = await fetch(`${session.serverUrl}/api/users/${encodeURIComponent(session.username)}/active-room`);
        if (syncRes.ok) {
          const syncData = await syncRes.json();
          if (syncData.success && syncData.roomId) {
            console.log('[Extension] Auto-synced to active room:', syncData.roomId);
            chrome.storage.local.set({ roomId: syncData.roomId });
            isKickedOut = false;
          }
        }
      } catch (e) {}
    } else if (response.status === 403) {
      const data = await response.json();
      if (data.kickedOut) {
        // Permanently kicked — stop all future heartbeats
        isKickedOut = true;

        // Clear stored session so user has to manually reconnect with a different room
        chrome.storage.local.remove(['username', 'roomId'], () => {
          console.log('[Extension] Cleared session after kick/ban.');
        });

        // Show a permanent notification
        chrome.notifications.create('kicked_' + Date.now(), {
          type: 'basic',
          iconUrl: 'icon128.png',
          title: '🚫 Permanently Removed from Room!',
          message: data.kickMessage || 'You exceeded the maximum distraction time and have been permanently removed from the room. You cannot re-enter.',
          priority: 2
        });
      }
    }
  } catch (error) {
    // Ignore temporary fetch failures to prevent spamming
  }
}
