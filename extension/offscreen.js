// Offscreen document to reliably play notification audio from Manifest V3 service worker

let currentAudio = null;

function playAudioFallback(type, volume = 0.7) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const gainNode = ctx.createGain();
    gainNode.gain.value = volume;
    gainNode.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === 'buzzer') {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.linearRampToValueAtTime(105, now + 0.6);

      const bGain = ctx.createGain();
      bGain.gain.setValueAtTime(volume * 0.8, now);
      bGain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);

      osc.connect(bGain);
      bGain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.65);
    } else {
      // Alarm: 3 high beeps
      [0, 0.2, 0.4].forEach((start) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(950, now + start);
        osc.frequency.setValueAtTime(1400, now + start + 0.07);

        const bGain = ctx.createGain();
        bGain.gain.setValueAtTime(volume, now + start);
        bGain.gain.exponentialRampToValueAtTime(0.001, now + start + 0.14);

        osc.connect(bGain);
        bGain.connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + 0.14);
      });
    }
  } catch (e) {
    console.debug('WebAudio fallback error:', e);
  }
}

function playSound(choice, volumePct = 70, customData = null) {
  if (choice === 'none') return;
  const vol = Math.max(0, Math.min(1, volumePct / 100));

  let src = '';
  if (choice === 'alarm') {
    src = chrome.runtime.getURL('assets/alarm.wav');
  } else if (choice === 'buzzer') {
    src = chrome.runtime.getURL('assets/buzzer.wav');
  } else if (choice === 'custom' && customData) {
    src = customData;
  }

  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch (e) {}
    currentAudio = null;
  }

  if (!src) {
    playAudioFallback(choice, vol);
    return;
  }

  try {
    currentAudio = new Audio(src);
    currentAudio.volume = vol;
    currentAudio.play().catch((err) => {
      console.warn('Audio.play() failed, trying synth fallback:', err);
      playAudioFallback(choice, vol);
    });
  } catch (err) {
    playAudioFallback(choice, vol);
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'OFFSCREEN_PLAY_SOUND') {
    playSound(msg.choice, msg.volume, msg.customSoundData);
  }
});
