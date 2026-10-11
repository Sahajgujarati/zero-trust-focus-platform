let currentAudio = null;
let currentTimeout = null;

// Audio synthesis fallback using Web Audio API
function playSyntheticSound(type, volumePct = 70) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const vol = Math.max(0, Math.min(1, volumePct / 100));
    const now = ctx.currentTime;

    if (type === 'buzzer') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.linearRampToValueAtTime(105, now + 0.6);

      gain.gain.setValueAtTime(vol * 0.8, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.65);
      return 700;
    } else {
      // Alarm: 3 rapid alert beeps
      [0, 0.2, 0.4].forEach((start) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(950, now + start);
        osc.frequency.setValueAtTime(1400, now + start + 0.07);

        gain.gain.setValueAtTime(vol, now + start);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + 0.14);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + 0.14);
      });
      return 600;
    }
  } catch (err) {
    console.debug('WebAudio synthesis error:', err);
    return 0;
  }
}

function stopCurrentSound() {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch (e) {}
    currentAudio = null;
  }
  if (currentTimeout) {
    clearTimeout(currentTimeout);
    currentTimeout = null;
  }
  setTestBtnState(false);
}

function setTestBtnState(isPlaying) {
  const btn = document.getElementById('testSoundBtn');
  const icon = document.getElementById('testSoundIcon');
  const text = document.getElementById('testSoundText');
  if (!btn || !icon || !text) return;

  if (isPlaying) {
    btn.classList.add('playing');
    icon.textContent = '⏹';
    text.textContent = 'Stop';
  } else {
    btn.classList.remove('playing');
    icon.textContent = '▶';
    text.textContent = 'Test';
  }
}

// Play selected sound (for preview/testing or alert)
function playSound(choice, volumePct = 70, customData = null, onEndCallback = null) {
  if (choice === 'none') {
    if (onEndCallback) onEndCallback();
    return;
  }

  stopCurrentSound();
  const vol = Math.max(0, Math.min(1, volumePct / 100));

  let src = '';
  if (choice === 'alarm') {
    src = chrome.runtime.getURL('assets/alarm.wav');
  } else if (choice === 'buzzer') {
    src = chrome.runtime.getURL('assets/buzzer.wav');
  } else if (choice === 'custom' && customData) {
    src = customData;
  }

  setTestBtnState(true);

  const finish = () => {
    stopCurrentSound();
    if (onEndCallback) onEndCallback();
  };

  if (!src) {
    const dur = playSyntheticSound(choice, volumePct);
    currentTimeout = setTimeout(finish, dur || 800);
    return;
  }

  try {
    currentAudio = new Audio(src);
    currentAudio.volume = vol;

    currentAudio.onended = finish;
    currentAudio.onerror = () => {
      console.warn('Native Audio failed to play, switching to synth:', src);
      const dur = playSyntheticSound(choice, volumePct);
      currentTimeout = setTimeout(finish, dur || 800);
    };

    const playPromise = currentAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('Audio play rejection, switching to synth:', err);
        const dur = playSyntheticSound(choice, volumePct);
        currentTimeout = setTimeout(finish, dur || 800);
      });
    }

    // Safety timeout in case audio hangs
    currentTimeout = setTimeout(() => {
      if (currentAudio) finish();
    }, 10000);
  } catch (err) {
    const dur = playSyntheticSound(choice, volumePct);
    currentTimeout = setTimeout(finish, dur || 800);
  }
}

// ---------------------------------------------------
// DOM & Sound Settings Initialization
// ---------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const usernameInput = document.getElementById('username');
  const roomIdInput = document.getElementById('roomId');
  const togglePasswordBtn = document.getElementById('togglePasswordBtn');
  const connectBtn = document.getElementById('connectBtn');
  const statusDiv = document.getElementById('status');

  const soundChoiceEl = document.getElementById('soundChoice');
  const testSoundBtn = document.getElementById('testSoundBtn');
  const customSoundWrapper = document.getElementById('customSoundWrapper');
  const customInput = document.getElementById('customSound');
  const customNameEl = document.getElementById('customSoundName');
  const volumeEl = document.getElementById('soundVolume');
  const volumeValTag = document.getElementById('volumeValTag');

  // Eye icon: hover to view password, mouseout to hide (and click toggle)
  if (togglePasswordBtn && roomIdInput) {
    const showPassword = () => { roomIdInput.type = 'text'; };
    const hidePassword = () => { roomIdInput.type = 'password'; };

    togglePasswordBtn.addEventListener('mouseenter', showPassword);
    togglePasswordBtn.addEventListener('mouseleave', hidePassword);
    togglePasswordBtn.addEventListener('click', (e) => {
      e.preventDefault();
      roomIdInput.type = roomIdInput.type === 'password' ? 'text' : 'password';
    });
  }

  // Load saved credentials (with auto-sync to active room)
  chrome.storage.local.get(['username', 'roomId'], async (result) => {
    if (result.username) usernameInput.value = result.username;
    if (result.roomId) {
      roomIdInput.value = result.roomId;
      statusDiv.innerHTML = `<span class="connected-badge">● Extension Active</span>`;
    }

    if (result.username) {
      try {
        const syncRes = await fetch(`http://localhost:4000/api/users/${encodeURIComponent(result.username)}/active-room`);
        if (syncRes.ok) {
          const syncData = await syncRes.json();
          if (syncData.success && syncData.roomId) {
            roomIdInput.value = syncData.roomId;
            statusDiv.innerHTML = `<span class="connected-badge">● Connected to "${syncData.roomName}"</span>`;
            if (syncData.roomId !== result.roomId) {
              chrome.storage.local.set({ roomId: syncData.roomId }, () => {
                chrome.runtime.sendMessage({ type: 'CONNECT', username: result.username, roomId: syncData.roomId });
              });
            }
          }
        }
      } catch (e) {}
    }
  });

  // Load sound preferences
  chrome.storage.local.get(['soundChoice', 'soundVolume', 'customSoundData', 'customSoundName'], (result) => {
    const choice = result.soundChoice || 'alarm';
    soundChoiceEl.value = choice;
    updateTestBtnDisabled(choice);

    if (result.soundVolume !== undefined) {
      volumeEl.value = result.soundVolume;
      volumeValTag.textContent = result.soundVolume + '%';
    } else {
      volumeEl.value = 70;
      volumeValTag.textContent = '70%';
    }

    if (choice === 'custom') {
      customSoundWrapper.style.display = 'block';
      if (result.customSoundName) {
        customNameEl.textContent = '🎵 ' + result.customSoundName;
      }
    }
  });

  function updateTestBtnDisabled(choice) {
    if (choice === 'none') {
      testSoundBtn.disabled = true;
      testSoundBtn.title = 'Sound is muted';
    } else {
      testSoundBtn.disabled = false;
      testSoundBtn.title = 'Click to test sound';
    }
  }

  // Sound Choice change
  soundChoiceEl.addEventListener('change', () => {
    const val = soundChoiceEl.value;
    chrome.storage.local.set({ soundChoice: val });
    updateTestBtnDisabled(val);

    if (val === 'custom') {
      customSoundWrapper.style.display = 'block';
    } else {
      customSoundWrapper.style.display = 'none';
      stopCurrentSound();
    }
  });

  // Test sound button
  testSoundBtn.addEventListener('click', () => {
    if (testSoundBtn.classList.contains('playing')) {
      stopCurrentSound();
      return;
    }

    const choice = soundChoiceEl.value;
    if (choice === 'none') return;

    const volume = Number(volumeEl.value) || 70;
    chrome.storage.local.get(['customSoundData'], (res) => {
      playSound(choice, volume, res.customSoundData);
    });
  });

  // Upload custom audio
  customInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const fileName = file.name;
      customNameEl.textContent = 'Loading ' + fileName + '...';
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        chrome.storage.local.set({
          customSoundData: dataUrl,
          customSoundName: fileName
        }, () => {
          customNameEl.textContent = '🎵 ' + fileName;
          // Play preview sample of uploaded file
          const volume = Number(volumeEl.value) || 70;
          playSound('custom', volume, dataUrl);
        });
      };
      reader.readAsDataURL(file);
    }
  });

  // Volume slider
  volumeEl.addEventListener('input', () => {
    const val = Number(volumeEl.value);
    volumeValTag.textContent = val + '%';
    chrome.storage.local.set({ soundVolume: val });
  });

  // Connect Button
  connectBtn.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    const roomId = roomIdInput.value.trim();

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

      chrome.storage.local.set({ username, roomId: activeRoomId }, () => {
        statusDiv.innerHTML = `<span class="connected-badge">● Connected to "${roomDisplayName}"</span>`;
        chrome.runtime.sendMessage({ type: 'CONNECT', username, roomId: activeRoomId });
      });
    } catch (err) {
      statusDiv.innerHTML = `<span style="color:#ef4444">❌ Server unreachable. Make sure backend is running on :4000</span>`;
    }
  });
});

// Play alert sound when server notifies of distraction
async function playAlertSound() {
  const prefs = await new Promise((resolve) => {
    chrome.storage.local.get(['soundChoice', 'soundVolume', 'customSoundData'], resolve);
  });
  const choice = prefs.soundChoice || 'alarm';
  if (choice === 'none') return;

  playSound(choice, prefs.soundVolume !== undefined ? prefs.soundVolume : 70, prefs.customSoundData);
}

// Listen for alert messages from background script
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'ALERT') {
    playAlertSound();
  }
});
