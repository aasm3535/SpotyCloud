import type { SCTrack } from '$lib/api/types';
import { loadDataSync, loadData, saveData } from '$lib/utils/storage';

export interface Playlist {
  id: string;
  name: string;
  tracks: SCTrack[];
  createdAt: number;
}

const STORAGE_KEY = 'spotycloud_playlists';

let playlists = $state<Playlist[]>(loadDataSync(STORAGE_KEY, []));

export async function initPlaylists() {
  playlists = await loadData<Playlist[]>(STORAGE_KEY, []);
}

function save() {
  saveData(STORAGE_KEY, playlists);
}

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
  save();
  return pl;
}

export function deletePlaylist(id: string) {
  playlists = playlists.filter(p => p.id !== id);
  save();
}

export function renamePlaylist(id: string, name: string) {
  playlists = playlists.map(p => p.id === id ? { ...p, name } : p);
  save();
}

export function addTrackToPlaylist(playlistId: string, track: SCTrack) {
  playlists = playlists.map(p => {
    if (p.id !== playlistId) return p;
    if (p.tracks.some(t => t.id === track.id)) return p;
    return { ...p, tracks: [...p.tracks, track] };
  });
  save();
}

export function removeTrackFromPlaylist(playlistId: string, trackId: number) {
  playlists = playlists.map(p => {
    if (p.id !== playlistId) return p;
    return { ...p, tracks: p.tracks.filter(t => t.id !== trackId) };
  });
  save();
}

export function getPlaylistById(id: string): Playlist | undefined {
  return playlists.find(p => p.id === id);
}

/** Add multiple tracks to a playlist at once, saving only once */
export function addTracksToPlaylistBatch(playlistId: string, tracks: SCTrack[]) {
  playlists = playlists.map(p => {
    if (p.id !== playlistId) return p;
    const existingIds = new Set(p.tracks.map(t => t.id));
    const newTracks = tracks.filter(t => !existingIds.has(t.id));
    if (newTracks.length === 0) return p;
    return { ...p, tracks: [...p.tracks, ...newTracks] };
  });
  save();
}
