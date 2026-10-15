/**
 * Scanner Audio Utility
 * Provides lightweight, offline Web Audio synthesis for barcode scanner confirmation & error tones.
 * Does not require external audio files or network requests.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Play authentic barcode scanner success beep (Crisp high-pitch tone: ~1600Hz, 70ms)
 */
export function playScanSuccessTone(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const startTime = ctx.currentTime;
    osc.frequency.setValueAtTime(1600, startTime);
    osc.frequency.exponentialRampToValueAtTime(1850, startTime + 0.05);

    gain.gain.setValueAtTime(0.25, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + 0.075);
  } catch {
    // Ignore audio failures if browser blocks autoplay
  }
}

/**
 * Play barcode scanner error buzz (Low-pitch warning tone: ~260Hz, 160ms)
 */
export function playScanErrorTone(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    const startTime = ctx.currentTime;
    osc.frequency.setValueAtTime(260, startTime);
    osc.frequency.linearRampToValueAtTime(180, startTime + 0.15);

    gain.gain.setValueAtTime(0.2, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + 0.17);
  } catch {
    // Ignore audio failures
  }
}
