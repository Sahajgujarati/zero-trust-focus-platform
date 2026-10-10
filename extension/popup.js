document.addEventListener('DOMContentLoaded', () => {
  const usernameInput = document.getElementById('username');
  const roomIdInput = document.getElementById('roomId');
  const connectBtn = document.getElementById('connectBtn');
  const statusDiv = document.getElementById('status');

  // Load saved credentials
  chrome.storage.local.get(['username', 'roomId'], (result) => {
    if (result.username) usernameInput.value = result.username;
    if (result.roomId) {
      roomIdInput.value = result.roomId;
      statusDiv.innerHTML = `<span class="connected-badge">● Extension Active</span>`;
    }
  });

  connectBtn.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    const roomId = roomIdInput.value.trim(); // Holds room name, ID, or password

    if (!username || !roomId) {
      statusDiv.innerHTML = `<span style="color:#ef4444">⚠️ Please fill both fields</span>`;
      return;
    }

    statusDiv.innerHTML = `<span style="color:#38bdf8">⏳ Verifying connection...</span>`;

    try {
      const res = await fetch('http://localhost:4000/api/rooms/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, password: roomId, username })
      });

      const data = await res.json();
      if (!res.ok) {
        statusDiv.innerHTML = `<span style="color:#ef4444">❌ ${data.error || 'Room not found or wrong password'}</span>`;
        return;
      }

      const activeRoomId = data.room?.id || roomId;
      const roomDisplayName = data.room?.name || roomId;

      // Save verified credentials to storage
      chrome.storage.local.set({ username, roomId: activeRoomId }, () => {
        statusDiv.innerHTML = `<span class="connected-badge">● Connected to "${roomDisplayName}"</span>`;
        // Notify background script
        chrome.runtime.sendMessage({ type: 'CONNECT', username, roomId: activeRoomId });
      });
    } catch (err) {
      statusDiv.innerHTML = `<span style="color:#ef4444">❌ Server unreachable. Make sure backend is running on :4000</span>`;
    }
  });
});
