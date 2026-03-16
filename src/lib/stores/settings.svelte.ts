import { loadDataSync, loadData, saveData } from '$lib/utils/storage';

const STORAGE_KEY = 'app_settings';
const PLAYER_STATE_KEY = 'player_state';

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

function save() {
  saveData(STORAGE_KEY, settings);
}

function savePlayerState() {
  saveData(PLAYER_STATE_KEY, playerState);
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
  };
}

export function setDisableCardHover(value: boolean) {
  settings.disableCardHover = value;
  save();
}

export function getSavedPlayerState(): SavedPlayerState {
  return { ...playerState };
}

export function savePlayerVolume(v: number) {
  playerState.volume = v;
  savePlayerState();
}

export function savePlayerShuffle(v: boolean) {
  playerState.isShuffle = v;
  savePlayerState();
}

export function savePlayerRepeat(v: 'none' | 'all' | 'one') {
  playerState.repeatMode = v;
  savePlayerState();
}

export function savePlayerLastTrack(trackId: number | null) {
  playerState.lastTrackId = trackId;
  savePlayerState();
}

export function setAlwaysCollapsedSidebar(value: boolean) {
  settings.alwaysCollapsedSidebar = value;
  save();
}

export function setDiscordRpcEnabled(value: boolean) {
  settings.discordRpcEnabled = value;
  save();
}

export function setDiscordShowListenButton(value: boolean) {
  settings.discordShowListenButton = value;
  save();
}

export function setCloseToTray(value: boolean) {
  settings.closeToTray = value;
  save();
}

export function setWaveTheme(value: string) {
  settings.waveTheme = value;
  save();
}

export function setReactiveWave(value: boolean) {
  settings.reactiveWave = value;
  save();
}

export function setLyricsGlow(value: boolean) {
  settings.lyricsGlow = value;
  save();
}

export function setLyricsFontSize(value: number) {
  settings.lyricsFontSize = value;
  save();
}

export function setLyricsTextAlign(value: 'center' | 'left') {
  settings.lyricsTextAlign = value;
  save();
}
