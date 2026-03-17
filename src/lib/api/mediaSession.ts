import { invoke } from '@tauri-apps/api/core';

export interface MediaSessionConfig {
  title: string;
  artist: string;
  artworkUrl?: string;
  durationSecs?: number;
  isPlaying: boolean;
}

export async function updateMediaSession(config: MediaSessionConfig): Promise<void> {
  try {
    await invoke('update_media_session', {
      config: {
        title: config.title,
        artist: config.artist,
        artwork_url: config.artworkUrl,
        duration_secs: config.durationSecs,
        is_playing: config.isPlaying
      }
    });
  } catch (error) {
    console.warn('[Media Session] Update failed:', error);
  }
}

export async function clearMediaSession(): Promise<void> {
  try {
    await invoke('clear_media_session');
  } catch (error) {
    console.warn('[Media Session] Clear failed:', error);
  }
}
