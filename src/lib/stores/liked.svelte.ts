import type { SCTrack } from '$lib/api/types';
import { loadDataSync, loadData, saveData } from '$lib/utils/storage';

const IDS_KEY = 'liked_tracks';
const DATA_KEY = 'liked_tracks_data';

let likedTrackIds = $state<number[]>(loadDataSync(IDS_KEY, []));
let likedTrackData: Map<number, SCTrack> = new Map();

// Load track data from sync cache
const cachedData = loadDataSync<SCTrack[]>(DATA_KEY, []);
if (cachedData.length > 0) {
  likedTrackData = new Map(cachedData.map(t => [t.id, t]));
}

// Async init: load from file storage (migrates localStorage automatically)
export async function initLiked() {
  const ids = await loadData<number[]>(IDS_KEY, []);
  const data = await loadData<SCTrack[]>(DATA_KEY, []);
  likedTrackIds = ids;
  likedTrackData = new Map(data.map(t => [t.id, t]));
}

function saveAll() {
  // Filter out local tracks (negative IDs) - they have Object URLs that expire after session
  const persistentIds = likedTrackIds.filter(id => id > 0);
  const persistentData = [...likedTrackData.values()].filter(t => t.id > 0);
  
  saveData(IDS_KEY, persistentIds);
  saveData(DATA_KEY, persistentData);
}

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
    saveAll();
    return false;
  } else {
    likedTrackIds = [...likedTrackIds, track.id];
    likedTrackData.set(track.id, track);
    saveAll();
    return true;
  }
}

export function likeTrack(track: SCTrack) {
  if (!isLiked(track.id)) {
    likedTrackIds = [...likedTrackIds, track.id];
    likedTrackData.set(track.id, track);
    saveAll();
  }
}

export function unlikeTrack(trackId: number) {
  likedTrackIds = likedTrackIds.filter(id => id !== trackId);
  likedTrackData.delete(trackId);
  saveAll();
}

/** Add multiple tracks at once, saving only once at the end */
export function likeTracksBatch(tracks: SCTrack[]) {
  const existingIds = new Set(likedTrackIds);
  const newIds: number[] = [];
  for (const track of tracks) {
    if (!existingIds.has(track.id)) {
      newIds.push(track.id);
      likedTrackData.set(track.id, track);
      existingIds.add(track.id);
    }
  }
  if (newIds.length > 0) {
    likedTrackIds = [...likedTrackIds, ...newIds];
    saveAll();
  }
}
