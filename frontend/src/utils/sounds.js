let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Unlock AudioContext on any user interaction (required by mobile browsers)
if (typeof document !== 'undefined') {
  document.addEventListener('click', () => {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  });
  document.addEventListener('touchstart', () => {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  });
}

/**
 * Alarm ring (despertador/teléfono) — played when countdown reaches zero.
 * Classic "tring-tring" pattern repeated 3 times.
 */
export function playAlarm() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  for (let cycle = 0; cycle < 3; cycle++) {
    const base = now + cycle * 1.0;

    // First ring
    const o1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    o1.connect(g1);
    g1.connect(ctx.destination);
    o1.type = 'square';
    o1.frequency.value = 1050;
    g1.gain.setValueAtTime(0, base);
    g1.gain.linearRampToValueAtTime(0.15, base + 0.01);
    g1.gain.setValueAtTime(0.15, base + 0.15);
    g1.gain.linearRampToValueAtTime(0, base + 0.17);
    o1.start(base);
    o1.stop(base + 0.18);

    // Second ring
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.connect(g2);
    g2.connect(ctx.destination);
    o2.type = 'square';
    o2.frequency.value = 1050;
    g2.gain.setValueAtTime(0, base + 0.25);
    g2.gain.linearRampToValueAtTime(0.15, base + 0.26);
    g2.gain.setValueAtTime(0.15, base + 0.40);
    g2.gain.linearRampToValueAtTime(0, base + 0.42);
    o2.start(base + 0.25);
    o2.stop(base + 0.43);
  }
}

/**
 * Pop — played when a new message is received on the message board.
 */
export function playPop() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(700, now);
  osc.frequency.exponentialRampToValueAtTime(250, now + 0.08);
  gain.gain.setValueAtTime(0.45, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  osc.start(now);
  osc.stop(now + 0.09);
}

/**
 * Siren — played when the admin manually triggers it.
 * Wailing sound sweeping between low and high frequencies for 4 seconds.
 */
export function playSiren() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  const duration = 4;
  const sweepDuration = 0.5;
  const lowFreq = 440;
  const highFreq = 1200;
  const steps = Math.ceil(duration / sweepDuration);

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = 'sawtooth';

  for (let i = 0; i < steps; i++) {
    const t = now + i * sweepDuration;
    const fromFreq = i % 2 === 0 ? lowFreq : highFreq;
    const toFreq = i % 2 === 0 ? highFreq : lowFreq;
    osc.frequency.setValueAtTime(fromFreq, t);
    osc.frequency.linearRampToValueAtTime(toFreq, t + sweepDuration);
  }

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.setValueAtTime(0.2, now + duration - 0.15);
  gain.gain.linearRampToValueAtTime(0, now + duration);

  osc.start(now);
  osc.stop(now + duration);
}
