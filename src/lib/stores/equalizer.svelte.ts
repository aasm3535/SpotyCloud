// 10-band equalizer using Web Audio API
import { loadDataSync, saveData } from '$lib/utils/storage';

const BANDS = [
  { freq: 60, label: '60' },
  { freq: 170, label: '170' },
  { freq: 310, label: '310' },
  { freq: 600, label: '600' },
  { freq: 1000, label: '1K' },
  { freq: 3000, label: '3K' },
  { freq: 6000, label: '6K' },
  { freq: 12000, label: '12K' },
  { freq: 14000, label: '14K' },
  { freq: 16000, label: '16K' },
] as const;

export type PresetName =
  | 'Flat'
  | 'Bass Boost'
  | 'Bass Cut'
  | 'Treble Boost'
  | 'Treble Cut'
  | 'Vocal'
  | 'Electronic'
  | 'Rock'
  | 'Pop'
  | 'Classical'
  | 'Hip-Hop'
  | 'Jazz'
  | 'Loudness'
  | 'Custom';

const PRESETS: Record<Exclude<PresetName, 'Custom'>, number[]> = {
  'Flat':         [0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
  'Bass Boost':   [6,  5,  4,  2,  0,  0,  0,  0,  0,  0],
  'Bass Cut':     [-6, -5, -4, -2, 0,  0,  0,  0,  0,  0],
  'Treble Boost': [0,  0,  0,  0,  0,  1,  3,  5,  6,  6],
  'Treble Cut':   [0,  0,  0,  0,  0, -1, -3, -5, -6, -6],
  'Vocal':        [-2, -1,  0,  2,  4,  4,  3,  1,  0, -1],
  'Electronic':   [4,  3,  1,  0, -2,  1,  0,  3,  4,  5],
  'Rock':         [5,  4,  2,  0, -1, -1,  1,  3,  4,  5],
  'Pop':          [-1,  1,  3,  4,  3,  0, -1, -1,  1,  2],
  'Classical':    [0,  0,  0,  0,  0,  0, -2, -3, -3, -4],
  'Hip-Hop':      [5,  4,  1,  3, -1, -1,  1,  0,  2,  3],
  'Jazz':         [0,  0,  1,  3,  3,  3,  0,  1,  2,  3],
  'Loudness':     [6,  4,  0, -2,  0, -1,  0,  0,  4,  5],
};

let audioContext: AudioContext | null = null;
let filters: BiquadFilterNode[] = [];
let sourceNode: MediaElementAudioSourceNode | null = null;
let connectedElement: HTMLAudioElement | null = null;
let isConnected = false;

let gains = $state<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
let activePreset = $state<PresetName>('Flat');
let enabled = $state(true);

function loadSaved() {
  try {
    const saved = loadDataSync<{ gains: number[]; preset: PresetName; enabled: boolean } | null>('eq_state', null);
    if (saved) {
      if (saved.gains?.length === 10) gains = saved.gains;
      if (saved.preset) activePreset = saved.preset;
      if (typeof saved.enabled === 'boolean') enabled = saved.enabled;
    }
  } catch {}
}

function save() {
  saveData('eq_state', {
    gains: [...gains],
    preset: activePreset,
    enabled,
  });
}

function initContext() {
  if (audioContext) return;
  try {
    audioContext = new AudioContext();
    filters = BANDS.map(({ freq }, i) => {
      const filter = audioContext!.createBiquadFilter();
      filter.type = i === 0 ? 'lowshelf' : i === BANDS.length - 1 ? 'highshelf' : 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1.4;
      filter.gain.value = enabled ? gains[i] : 0;
      return filter;
    });
    for (let i = 0; i < filters.length - 1; i++) {
      filters[i].connect(filters[i + 1]);
    }
    filters[filters.length - 1].connect(audioContext.destination);
  } catch (e) {
    console.warn('[EQ] Failed to create AudioContext:', e);
    audioContext = null;
    filters = [];
  }
}

async function resumeContext() {
  if (audioContext && audioContext.state === 'suspended') {
    try {
      await audioContext.resume();
      console.log('[EQ] AudioContext resumed');
    } catch (e) {
      console.warn('[EQ] Failed to resume AudioContext:', e);
    }
  }
}

export function connectAudio(audioEl: HTMLAudioElement) {
  // Store reference but don't connect yet — wait for first play
  if (connectedElement === audioEl && isConnected) return;
  connectedElement = audioEl;

  // Set crossOrigin for Web Audio API compatibility
  audioEl.crossOrigin = 'anonymous';

  // Connect on first play event (ensures user gesture + audio is ready)
  const doConnect = async () => {
    if (isConnected) return;

    try {
      initContext();
      if (!audioContext) return;

      await resumeContext();

      // Only create source node once per element
      if (sourceNode) {
        try { sourceNode.disconnect(); } catch {}
      }
      sourceNode = audioContext.createMediaElementSource(audioEl);
      sourceNode.connect(filters[0]);
      isConnected = true;
      console.log('[EQ] Connected to audio element');
    } catch (e) {
      console.warn('[EQ] Failed to connect, audio will play without EQ:', e);
      // If connection fails, audio still plays through default output
      isConnected = false;
    }
  };

  audioEl.addEventListener('play', doConnect, { once: true });
}

export function setBandGain(index: number, value: number) {
  gains[index] = value;
  if (filters[index] && enabled) {
    filters[index].gain.value = value;
  }
  activePreset = 'Custom';
  save();
}

export function applyPreset(name: Exclude<PresetName, 'Custom'>) {
  const values = PRESETS[name];
  gains = [...values];
  activePreset = name;
  if (enabled) {
    filters.forEach((f, i) => { f.gain.value = values[i]; });
  }
  save();
}

export function toggleEq() {
  enabled = !enabled;
  filters.forEach((f, i) => {
    f.gain.value = enabled ? gains[i] : 0;
  });
  save();
}

export function getEqualizer() {
  loadSaved();
  return {
    get bands() { return BANDS; },
    get gains() { return gains; },
    get activePreset() { return activePreset; },
    get enabled() { return enabled; },
    get presetNames() { return Object.keys(PRESETS) as Exclude<PresetName, 'Custom'>[]; },
  };
}
