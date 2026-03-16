/**
 * Audio analyser for reactive wave visualizations.
 * Hooks into the equalizer's AudioContext to read frequency data.
 */

let analyser: AnalyserNode | null = null;
let dataArray: Uint8Array | null = null;
let rafId: number | null = null;

// Reactive state: 4 energy bands (bass, low-mid, high-mid, treble)
let bass = $state(0);
let lowMid = $state(0);
let highMid = $state(0);
let treble = $state(0);
let energy = $state(0);
let active = $state(false);

export function getAudioAnalyser() {
  return {
    get bass() { return bass; },
    get lowMid() { return lowMid; },
    get highMid() { return highMid; },
    get treble() { return treble; },
    get energy() { return energy; },
    get active() { return active; },
  };
}

export function connectAnalyser(audioContext: AudioContext, sourceNode: AudioNode) {
  if (analyser) {
    try { analyser.disconnect(); } catch {}
  }

  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.8;
  dataArray = new Uint8Array(analyser.frequencyBinCount);

  // Tap into the source — connect analyser in parallel (doesn't affect audio output)
  sourceNode.connect(analyser);

  if (!rafId) {
    tick();
  }
  active = true;
}

export function disconnectAnalyser() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (analyser) {
    try { analyser.disconnect(); } catch {}
    analyser = null;
  }
  bass = 0;
  lowMid = 0;
  highMid = 0;
  treble = 0;
  energy = 0;
  active = false;
}

function tick() {
  if (!analyser || !dataArray) return;

  analyser.getByteFrequencyData(dataArray);

  const len = dataArray.length; // 128 bins
  // Split into 4 bands
  const bassEnd = Math.floor(len * 0.1);     // ~0-860Hz
  const lowMidEnd = Math.floor(len * 0.25);   // ~860-2150Hz
  const highMidEnd = Math.floor(len * 0.55);  // ~2150-4700Hz
  // rest is treble

  let bassSum = 0, lowMidSum = 0, highMidSum = 0, trebleSum = 0;

  for (let i = 0; i < len; i++) {
    const v = dataArray[i] / 255;
    if (i < bassEnd) bassSum += v;
    else if (i < lowMidEnd) lowMidSum += v;
    else if (i < highMidEnd) highMidSum += v;
    else trebleSum += v;
  }

  bass = bassSum / Math.max(1, bassEnd);
  lowMid = lowMidSum / Math.max(1, lowMidEnd - bassEnd);
  highMid = highMidSum / Math.max(1, highMidEnd - lowMidEnd);
  treble = trebleSum / Math.max(1, len - highMidEnd);
  energy = (bass * 0.4 + lowMid * 0.3 + highMid * 0.2 + treble * 0.1);

  rafId = requestAnimationFrame(tick);
}
