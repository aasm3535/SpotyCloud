import { loadDataSync, loadData, saveData } from '$lib/utils/storage';

const STORAGE_KEY = 'app_settings';
const PLAYER_STATE_KEY = 'player_state';

export type HotkeyAction = 'playPause' | 'nextTrack' | 'prevTrack' | 'volumeUp' | 'volumeDown' | 'mute';

export interface HotkeyBinding {
  action: HotkeyAction;
  key: string; // e.g., "M", "Z", "V"
  modifiers?: string[]; // e.g., ["Ctrl"], ["Alt"]
  combo?: string; // For two-key combos like "Z+V"
}

interface AppSettings {
  alwaysCollapsedSidebar: boolean;
  closeToTray: boolean;
  discordRpcEnabled: boolean;
  discordShowListenButton: boolean;
  waveTheme: string;
  reactiveWave: boolean;
  disableCardHover: boolean;
  lyricsGlow: boolean;
  lyricsFontSize: number;
  lyricsTextAlign: 'center' | 'left';
  hotkeys: Record<HotkeyAction, HotkeyBinding>;
}

export interface SavedPlayerState {
  volume: number;
  isShuffle: boolean;
  repeatMode: 'none' | 'all' | 'one';
  lastTrackId: number | null;
}

const defaults: AppSettings = {
  alwaysCollapsedSidebar: false,
  closeToTray: true,
  discordRpcEnabled: true,
  discordShowListenButton: true,
  waveTheme: 'default',
  reactiveWave: true,
  disableCardHover: false,
  lyricsGlow: true,
  lyricsFontSize: 28,
  lyricsTextAlign: 'center',
  hotkeys: {
    playPause: { action: 'playPause', key: 'M' },
    nextTrack: { action: 'nextTrack', key: 'Z' },
    prevTrack: { action: 'prevTrack', key: 'X' },
    volumeUp: { action: 'volumeUp', key: 'ArrowUp', modifiers: ['Ctrl'] },
    volumeDown: { action: 'volumeDown', key: 'ArrowDown', modifiers: ['Ctrl'] },
    mute: { action: 'mute', key: 'M', modifiers: ['Shift'] },
  },
};

const playerDefaults: SavedPlayerState = {
  volume: 0.7,
  isShuffle: false,
  repeatMode: 'none',
  lastTrackId: null,
};

let settings = $state<AppSettings>(loadDataSync(STORAGE_KEY, defaults));
let playerState = $state<SavedPlayerState>(loadDataSync(PLAYER_STATE_KEY, playerDefaults));

export async function initSettings() {
  // Merge saved data with defaults so new fields get their default values
  const saved = await loadData<Partial<AppSettings>>(STORAGE_KEY, defaults);
  settings = { ...defaults, ...saved };

  const savedPlayer = await loadData<Partial<SavedPlayerState>>(PLAYER_STATE_KEY, playerDefaults);
  playerState = { ...playerDefaults, ...savedPlayer };
}

async function save() {
  await saveData(STORAGE_KEY, settings);
}

async function savePlayerState() {
  await saveData(PLAYER_STATE_KEY, playerState);
}

export function getSettings() {
  return {
    get alwaysCollapsedSidebar() { return settings.alwaysCollapsedSidebar; },
    get closeToTray() { return settings.closeToTray; },
    get discordRpcEnabled() { return settings.discordRpcEnabled; },
    get discordShowListenButton() { return settings.discordShowListenButton; },
    get waveTheme() { return settings.waveTheme; },
    get reactiveWave() { return settings.reactiveWave; },
    get disableCardHover() { return settings.disableCardHover; },
    get lyricsGlow() { return settings.lyricsGlow; },
    get lyricsFontSize() { return settings.lyricsFontSize; },
    get lyricsTextAlign() { return settings.lyricsTextAlign; },
    get hotkeys() { return settings.hotkeys; },
  };
}

export async function setDisableCardHover(value: boolean) {
  settings.disableCardHover = value;
  await save();
}

export function getSavedPlayerState(): SavedPlayerState {
  return { ...playerState };
}

export async function savePlayerVolume(v: number) {
  playerState.volume = v;
  await savePlayerState();
}

export async function savePlayerShuffle(v: boolean) {
  playerState.isShuffle = v;
  await savePlayerState();
}

export async function savePlayerRepeat(v: 'none' | 'all' | 'one') {
  playerState.repeatMode = v;
  await savePlayerState();
}

export async function savePlayerLastTrack(trackId: number | null) {
  playerState.lastTrackId = trackId;
  await savePlayerState();
}

export async function setAlwaysCollapsedSidebar(value: boolean) {
  settings.alwaysCollapsedSidebar = value;
  await save();
}

export async function setDiscordRpcEnabled(value: boolean) {
  settings.discordRpcEnabled = value;
  await save();
}

export async function setDiscordShowListenButton(value: boolean) {
  settings.discordShowListenButton = value;
  await save();
}

export async function setCloseToTray(value: boolean) {
  settings.closeToTray = value;
  await save();
}

export async function setWaveTheme(value: string) {
  settings.waveTheme = value;
  await save();
}

export async function setReactiveWave(value: boolean) {
  settings.reactiveWave = value;
  await save();
}

export async function setLyricsGlow(value: boolean) {
  settings.lyricsGlow = value;
  await save();
}

export async function setLyricsFontSize(value: number) {
  settings.lyricsFontSize = value;
  await save();
}

export async function setLyricsTextAlign(value: 'center' | 'left') {
  settings.lyricsTextAlign = value;
  await save();
}

export async function setHotkey(action: HotkeyAction, binding: HotkeyBinding) {
  settings.hotkeys[action] = binding;
  await save();
}

export async function resetHotkeys() {
  settings.hotkeys = { ...defaults.hotkeys };
  await save();
}

export function formatHotkey(binding: HotkeyBinding): string {
  const parts: string[] = [];
  
  if (binding.modifiers) {
    parts.push(...binding.modifiers);
  }
  
  if (binding.combo) {
    parts.push(`${binding.key}+${binding.combo}`);
  } else {
    parts.push(binding.key);
  }
  
  return parts.join('+');
}

// System shortcuts that should be avoided
const SYSTEM_SHORTCUTS = [
  'Ctrl+C', 'Ctrl+V', 'Ctrl+X', 'Ctrl+Z', 'Ctrl+Y', 'Ctrl+A', 'Ctrl+S',
  'Ctrl+P', 'Ctrl+F', 'Ctrl+H', 'Ctrl+N', 'Ctrl+O', 'Ctrl+W', 'Ctrl+Q',
  'Alt+F4', 'Alt+Tab', 'Ctrl+Alt+Delete', 'Win+L', 'Win+D', 'Win+E',
  'F1', 'F5', 'F11', 'F12', 'Ctrl+Shift+Esc', 'Ctrl+Alt+Tab',
];

export function checkHotkeyConflict(binding: HotkeyBinding): string | null {
  const formatted = formatHotkey(binding);
  
  // Check system shortcuts
  if (SYSTEM_SHORTCUTS.includes(formatted)) {
    return `Конфликт с системным сочетанием: ${formatted}`;
  }
  
  // Check conflicts with other hotkeys
  for (const [action, existingBinding] of Object.entries(settings.hotkeys)) {
    if (formatHotkey(existingBinding) === formatted) {
      return `Конфликт с действием: ${action}`;
    }
  }
  
  return null;
}
