// Simple keywords heuristic in background script to avoid complex AI setups for the extension MVP
const PRODUCTIVE_KEYWORDS = ["github", "leetcode", "stackoverflow", "docs", "developer", "localhost", "chatgpt"];
const DISTRACTING_KEYWORDS = ["youtube", "netflix", "twitter", "instagram", "facebook", "reddit"];

let activeSession = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CONNECT') {
    activeSession = {
      username: message.username,
      roomId: message.roomId
    };
    console.log("Session connected:", activeSession);
  }
});

// Load session on startup
chrome.storage.local.get(['username', 'roomId'], (result) => {
  if (result.username && result.roomId) {
    activeSession = {
      username: result.username,
      roomId: result.roomId
    };
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  handleTabChange(tab.url);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.active) {
    handleTabChange(changeInfo.url);
  }
});

async function handleTabChange(url) {
  if (!url || !activeSession || url.startsWith('chrome://')) return;

  const urlLower = url.toLowerCase();
  
  // Basic mock AI classification
  let isProductive = true;
  for (const keyword of DISTRACTING_KEYWORDS) {
    if (urlLower.includes(keyword)) {
      isProductive = false;
      break;
    }
  }

  // Send to backend via REST API (which then broadcasts to Socket.io frontend)
  try {
    const response = await fetch('https://zero-trust-focus-platform-1.onrender.com/api/activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        roomId: activeSession.roomId,
        username: activeSession.username,
        url: url,
        isProductive: isProductive
      })
    });
    
    if (!isProductive) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon128.png', // A fallback icon is fine
        title: 'Focus Alert!',
        message: 'Distracting tab detected. Your score is dropping!',
        priority: 2
      });
    }
  } catch (error) {
    console.error("Failed to sync activity to server", error);
  }
}
