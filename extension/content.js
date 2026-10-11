// Zero-Trust Focus Platform - Content Script for Instant Auto-Sync
(function () {
  function syncSession() {
    try {
      const raw = localStorage.getItem('focus_session');
      if (raw) {
        const session = JSON.parse(raw);
        if (session.username && session.roomId) {
          chrome.storage.local.get(['username', 'roomId'], (current) => {
            if (current.username !== session.username || current.roomId !== session.roomId) {
              console.log('[Zero-Trust Sync] Auto-syncing session from Web App:', session.username, session.roomId);
              chrome.storage.local.set({
                username: session.username,
                roomId: session.roomId
              }, () => {
                chrome.runtime.sendMessage({
                  type: 'CONNECT',
                  username: session.username,
                  roomId: session.roomId
                });
              });
            }
          });
        }
      }
    } catch (e) {}
  }

  // 1. Sync on page load
  syncSession();

  // 2. Poll every 2 seconds while dashboard is open to detect any room changes or restarts
  setInterval(syncSession, 2000);

  // 3. Instant event listener for postMessage from React app
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'ZERO_TRUST_SYNC_ROOM') {
      const { username, roomId } = event.data;
      if (username && roomId) {
        chrome.storage.local.set({ username, roomId }, () => {
          chrome.runtime.sendMessage({
            type: 'CONNECT',
            username,
            roomId
          });
        });
      }
    }
  });
})();
