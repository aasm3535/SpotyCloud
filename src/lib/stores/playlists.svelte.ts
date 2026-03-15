import type { SCTrack } from '$lib/api/types';

export interface Playlist {
  id: string;
  name: string;
  tracks: SCTrack[];
  createdAt: number;
}

const STORAGE_KEY = 'spotycloud_playlists';

function loadPlaylists(): Playlist[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function savePlaylists(list: Playlist[]) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
}

let playlists = $state<Playlist[]>(loadPlaylists());

export function getPlaylists() {
  return {
    get list() { return playlists; },
    get count() { return playlists.length; },
  };
}

export function createPlaylist(name?: string): Playlist {
  const num = playlists.length + 1;
  const pl: Playlist = {
    id: crypto.randomUUID(),
    name: name || `My Playlist #${num}`,
    tracks: [],
    createdAt: Date.now(),
  };
  playlists = [pl, ...playlists];
  savePlaylists(playlists);
  return pl;
}

export function deletePlaylist(id: string) {
  playlists = playlists.filter(p => p.id !== id);
  savePlaylists(playlists);
}

export function renamePlaylist(id: string, name: string) {
  playlists = playlists.map(p => p.id === id ? { ...p, name } : p);
  savePlaylists(playlists);
}

export function addTrackToPlaylist(playlistId: string, track: SCTrack) {
  playlists = playlists.map(p => {
    if (p.id !== playlistId) return p;
    if (p.tracks.some(t => t.id === track.id)) return p;
    return { ...p, tracks: [...p.tracks, track] };
  });
  savePlaylists(playlists);
}

export function removeTrackFromPlaylist(playlistId: string, trackId: number) {
  playlists = playlists.map(p => {
    if (p.id !== playlistId) return p;
    return { ...p, tracks: p.tracks.filter(t => t.id !== trackId) };
  });
  savePlaylists(playlists);
}

export function getPlaylistById(id: string): Playlist | undefined {
  return playlists.find(p => p.id === id);
}
