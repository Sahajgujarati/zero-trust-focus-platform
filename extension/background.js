// Helper to reliably get active session from storage
async function getSession() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['username', 'roomId', 'serverUrl'], (result) => {
      if (result.username && result.roomId) {
        resolve({
          username: result.username.trim(),
          roomId: result.roomId.trim(),
          serverUrl: (result.serverUrl || 'http://localhost:4000').trim().replace(/\/$/, '')
        });
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
    console.log("[Extension] Connected session:", message.username, "Room:", message.roomId);
    triggerActiveTabSync();
  }
});

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

let lastRequestTime = 0;
let isKickedOut = false; // Set to true once user is permanently banned — stops all heartbeats


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
      }
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
