document.addEventListener('DOMContentLoaded', () => {
  const usernameInput = document.getElementById('username');
  const roomIdInput = document.getElementById('roomId');
  const connectBtn = document.getElementById('connectBtn');
  const statusDiv = document.getElementById('status');

  // Load saved data
  chrome.storage.local.get(['username', 'roomId'], (result) => {
    if (result.username) usernameInput.value = result.username;
    if (result.roomId) roomIdInput.value = result.roomId;
  });

  connectBtn.addEventListener('click', () => {
    const username = usernameInput.value;
    const roomId = roomIdInput.value;

    if (!username || !roomId) {
      statusDiv.innerText = "Error: Fill all fields";
      return;
    }

    // Save to storage
    chrome.storage.local.set({ username, roomId }, () => {
      statusDiv.innerText = "Connected! You can close this popup.";
      // Notify background script to connect
      chrome.runtime.sendMessage({ type: 'CONNECT', username, roomId });
    });
  });
});
