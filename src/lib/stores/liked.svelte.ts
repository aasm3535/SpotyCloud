import type { SCTrack } from '$lib/api/types';

const STORAGE_KEY = 'liked_tracks';
const TRACKS_STORAGE_KEY = 'liked_tracks_data';

function loadLikedIds(): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function loadLikedTrackData(): Map<number, SCTrack> {
  if (typeof window === 'undefined') return new Map();
  try {
    const stored = localStorage.getItem(TRACKS_STORAGE_KEY);
    if (!stored) return new Map();
    const arr: SCTrack[] = JSON.parse(stored);
    return new Map(arr.map(t => [t.id, t]));
  } catch {
    return new Map();
  }
}

function saveLikedIds(ids: number[]) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch {}
}

function saveLikedTrackData(data: Map<number, SCTrack>) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(TRACKS_STORAGE_KEY, JSON.stringify([...data.values()])); } catch {}
}

let likedTrackIds = $state<number[]>(loadLikedIds());
let likedTrackData: Map<number, SCTrack> = loadLikedTrackData();

export function getLikedTracks() {
  return {
    get ids() { return likedTrackIds; },
    get count() { return likedTrackIds.length; },
    get tracks(): SCTrack[] {
      return likedTrackIds
        .map(id => likedTrackData.get(id))
        .filter((t): t is SCTrack => t !== undefined);
    },
  };
}

export function isLiked(trackId: number): boolean {
  return likedTrackIds.includes(trackId);
}

export function toggleLike(track: SCTrack): boolean {
  const index = likedTrackIds.indexOf(track.id);
  if (index > -1) {
    likedTrackIds = likedTrackIds.filter(id => id !== track.id);
    likedTrackData.delete(track.id);
    saveLikedIds(likedTrackIds);
    saveLikedTrackData(likedTrackData);
    return false;
  } else {
    likedTrackIds = [...likedTrackIds, track.id];
    likedTrackData.set(track.id, track);
    saveLikedIds(likedTrackIds);
    saveLikedTrackData(likedTrackData);
    return true;
  }
}

export function likeTrack(track: SCTrack) {
  if (!isLiked(track.id)) {
    likedTrackIds = [...likedTrackIds, track.id];
    likedTrackData.set(track.id, track);
    saveLikedIds(likedTrackIds);
    saveLikedTrackData(likedTrackData);
  }
}

export function unlikeTrack(trackId: number) {
  likedTrackIds = likedTrackIds.filter(id => id !== trackId);
  likedTrackData.delete(trackId);
  saveLikedIds(likedTrackIds);
  saveLikedTrackData(likedTrackData);
}
