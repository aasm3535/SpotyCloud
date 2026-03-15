import { invoke } from '@tauri-apps/api/core';
import type { SCTrack } from '$lib/api/types';
import { loadDataSync, saveData } from '$lib/utils/storage';

export type DownloadStatus = 'idle' | 'downloading' | 'completed' | 'error';

interface DownloadState {
  status: DownloadStatus;
  progress: number;
  error?: string;
}

// Use plain objects for reactivity
const downloadStates = $state<Record<number, DownloadState>>({});
const offlineTrackIds = $state<Set<number>>(new Set());
const trackFilePaths = $state<Record<number, string>>({});

export function getDownloadStatus(trackId: number): DownloadState {
  return downloadStates[trackId] || { status: 'idle', progress: 0 };
}

export function isTrackDownloaded(trackId: number): boolean {
  return offlineTrackIds.has(trackId);
}

export function getTrackFilePath(trackId: number): string | undefined {
  const path = trackFilePaths[trackId];
  if (!path) return undefined;
  return path.replace(/\\/g, '/');
}

function sanitizeFilename(title: string, extension: string = 'mp3'): string {
  const cleanTitle = title
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 100);
  return `${cleanTitle}.${extension}`;
}

function getFileExtensionFromUrl(url: string): string {
  // Try to extract extension from URL
  const urlObj = new URL(url);
  const pathname = urlObj.pathname;
  const match = pathname.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  if (match) {
    return match[1].toLowerCase();
  }
  // Default to mp3 if can't determine
  return 'mp3';
}

export async function downloadTrack(track: SCTrack): Promise<void> {
  const trackId = track.id;
  
  // Set initial state
  downloadStates[trackId] = { status: 'downloading', progress: 0 };
  
  try {
    const { getStreamUrl } = await import('$lib/api/soundcloud');
    const streamUrl = await getStreamUrl(track);
    
    // Determine file extension from stream URL
    const extension = getFileExtensionFromUrl(streamUrl);
    const filename = `${track.user.username}_${sanitizeFilename(track.title, extension)}`;
    
    console.log('[downloadTrack] Starting download:', track.title, 'format:', extension);
    
    const filePath = await invoke<string>('download_track', {
      url: streamUrl,
      filename
    });
    
    console.log('[downloadTrack] Download complete:', filePath);
    
    // Update state on success
    downloadStates[trackId] = { status: 'completed', progress: 100 };
    offlineTrackIds.add(trackId);
    trackFilePaths[trackId] = filePath;
    
    saveOfflineTracks();
    
  } catch (error) {
    console.error('[downloadTrack] Failed:', error);
    downloadStates[trackId] = { 
      status: 'error', 
      progress: 0, 
      error: error instanceof Error ? error.message : 'Download failed' 
    };
    throw error;
  }
}

export async function deleteDownloadedTrack(trackId: number): Promise<void> {
  const filePath = trackFilePaths[trackId];
  if (!filePath) return;
  
  try {
    const filename = filePath.split('/').pop() || filePath.split('\\').pop();
    if (filename) {
      await invoke('delete_downloaded_track', { filename });
    }
    
    offlineTrackIds.delete(trackId);
    delete trackFilePaths[trackId];
    delete downloadStates[trackId];
    
    saveOfflineTracks();
  } catch (error) {
    console.error('Failed to delete track:', error);
    throw error;
  }
}

export async function checkTrackExists(track: SCTrack): Promise<boolean> {
  const filename = `${track.user.username}_${sanitizeFilename(track.title)}`;
  
  try {
    const exists = await invoke<boolean>('track_exists_locally', { filename });
    if (exists) {
      const downloadsDir = await invoke<string>('get_downloads_dir');
      const filePath = `${downloadsDir}/${filename}`;
      offlineTrackIds.add(track.id);
      trackFilePaths[track.id] = filePath;
    }
    return exists;
  } catch (error) {
    console.error('Failed to check track existence:', error);
    return false;
  }
}

// Load offline tracks from persistent storage
function loadOfflineTracks() {
  try {
    const saved = loadDataSync<{ trackIds: number[]; filePaths: Record<string, string> } | null>('spotycloud_offline_tracks', null);
    if (saved) {
      if (saved.trackIds) {
        saved.trackIds.forEach((id: number) => offlineTrackIds.add(id));
      }
      if (saved.filePaths) {
        Object.entries(saved.filePaths).forEach(([id, path]) => {
          trackFilePaths[Number(id)] = path as string;
        });
      }
    }
  } catch (e) {
    console.error('Failed to load offline tracks:', e);
  }
}

// Save offline tracks to persistent storage
function saveOfflineTracks() {
  saveData('spotycloud_offline_tracks', {
    trackIds: Array.from(offlineTrackIds),
    filePaths: trackFilePaths,
  });
}

// Initialize on module load
loadOfflineTracks();

// Re-export for use in components
export { offlineTrackIds, trackFilePaths };
