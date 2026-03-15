import type { SCTrack } from '$lib/api/types';
import { getStreamUrl } from '$lib/api/soundcloud';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { readFile } from '@tauri-apps/plugin-fs';
import { isTrackDownloaded, getTrackFilePath } from './downloads.svelte';
import Hls from 'hls.js';
import { connectAudio } from './equalizer.svelte';
import { getRelatedTracks } from '$lib/api/soundcloud';

// Read local file and create blob URL for playback
async function getLocalFileUrl(filePath: string): Promise<string> {
  try {
    // Read file as binary
    const fileData = await readFile(filePath);
    
    // Determine MIME type from extension
    const ext = filePath.split('.').pop()?.toLowerCase() || 'mp3';
    const mimeTypes: Record<string, string> = {
      'mp3': 'audio/mpeg',
      'ogg': 'audio/ogg',
      'oga': 'audio/ogg',
      'wav': 'audio/wav',
      'weba': 'audio/webm',
      'webm': 'audio/webm',
      'm4a': 'audio/mp4',
      'mp4': 'audio/mp4',
      'aac': 'audio/aac',
      'flac': 'audio/flac',
    };
    const mimeType = mimeTypes[ext] || 'audio/mpeg';
    
    // Create blob and URL
    const blob = new Blob([fileData], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    console.log('[getLocalFileUrl] Created blob URL for:', filePath, 'MIME:', mimeType);
    return url;
  } catch (e) {
    console.error('[getLocalFileUrl] Failed to read file:', e);
    throw e;
  }
}

function updateDiscordRpc(track: SCTrack) {
  const artworkUrl = track.artwork_url
    ? track.artwork_url.replace('-large', '-t500x500')
    : null;
  const durationSecs = track.duration ? Math.round(track.duration / 1000) : null;
  const trackUrl = track.permalink_url || null;
  invoke('discord_rpc_update', {
    title: track.title,
    artist: track.user.username,
    artworkUrl,
    durationSecs,
    trackUrl,
  }).catch((e) => console.warn('[Discord RPC] update failed:', e));
}

function clearDiscordRpc() {
  invoke('discord_rpc_clear').catch((e) => console.warn('[Discord RPC] clear failed:', e));
}

let currentTrack = $state<SCTrack | null>(null);
let queue = $state<SCTrack[]>([]);
let queueIndex = $state(-1);
let isPlaying = $state(false);
let currentTime = $state(0);
let duration = $state(0);
let volume = $state(0.7);
let isShuffle = $state(false);
let repeatMode = $state<'none' | 'all' | 'one'>('none');
let isLoading = $state(false);
let error = $state<string | null>(null);
let waveMode = $state(false);
let waveDisliked = $state<Set<number>>(loadDisliked());
let isWaveTrack = $state(false);

function loadDisliked(): Set<number> {
  try {
    const s = localStorage.getItem('wave_disliked');
    return s ? new Set(JSON.parse(s)) : new Set();
  } catch { return new Set(); }
}

function saveDisliked() {
  localStorage.setItem('wave_disliked', JSON.stringify([...waveDisliked]));
}

let audio: HTMLAudioElement | null = null;
let hls: Hls | null = null;

function getOrCreateAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.volume = volume;
    audio.addEventListener('timeupdate', () => {
      currentTime = audio!.currentTime;
    });
    audio.addEventListener('durationchange', () => {
      duration = audio!.duration;
    });
    audio.addEventListener('ended', () => {
      handleTrackEnd();
    });
    audio.addEventListener('play', () => { isPlaying = true; });
    audio.addEventListener('pause', () => { isPlaying = false; });
    audio.addEventListener('error', (e) => {
      console.error('Audio error:', e);
      error = 'Playback error: ' + (audio?.error?.message || 'Unknown error');
      isPlaying = false;
      isLoading = false;
    });
    // Connect to equalizer
    connectAudio(audio);
  }
  return audio;
}

function handleTrackEnd() {
  if (repeatMode === 'one') {
    const a = getOrCreateAudio();
    a.currentTime = 0;
    a.play();
    return;
  }
  next();
}

function updateMediaSession() {
  if (!('mediaSession' in navigator) || !currentTrack) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title: currentTrack.title,
    artist: currentTrack.user.username,
    artwork: currentTrack.artwork_url
      ? [{ src: currentTrack.artwork_url.replace('-large', '-t500x500'), sizes: '500x500', type: 'image/jpeg' }]
      : [],
  });

  navigator.mediaSession.setActionHandler('play', () => resume());
  navigator.mediaSession.setActionHandler('pause', () => pause());
  navigator.mediaSession.setActionHandler('previoustrack', () => prev());
  navigator.mediaSession.setActionHandler('nexttrack', () => next());
}

async function loadAndPlay(track: SCTrack) {
  isLoading = true;
  error = null;
  currentTrack = track;
  updateMediaSession();
  updateDiscordRpc(track);

  try {
    console.log('Loading track:', track.title, 'ID:', track.id);
    
    // Check if track is available offline
    const isOffline = isTrackDownloaded(track.id);
    const localPath = getTrackFilePath(track.id);
    
    let streamUrl: string;
    
    if (isOffline && localPath) {
      console.log('Playing from local file:', localPath);
      streamUrl = await getLocalFileUrl(localPath);
      console.log('Created blob URL for local file');
    } else {
      console.log('Fetching stream URL from SoundCloud...');
      streamUrl = await getStreamUrl(track);
      console.log('Got stream URL:', streamUrl.substring(0, 100) + '...');
    }
    
    const a = getOrCreateAudio();

    // Cleanup old HLS instance
    if (hls) {
      hls.destroy();
      hls = null;
    }

    // Check if it's an HLS stream (only for online streams)
    if (!isOffline && (streamUrl.includes('.m3u8') || streamUrl.includes('hls'))) {
      if (Hls.isSupported()) {
        console.log('Using HLS.js for playback');
        hls = new Hls({
          enableWorker: false, // Disable worker to avoid CORS issues
          xhrSetup: (xhr, url) => {
            // Log all requests for debugging
            console.log('HLS requesting:', url.substring(0, 80) + '...');
          }
        });
        hls.loadSource(streamUrl);
        hls.attachMedia(a);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('HLS manifest parsed, starting playback');
          a.play().then(() => {
            isLoading = false;
          }).catch(e => {
            console.error('Play error:', e);
            error = 'Failed to start playback: ' + e.message;
            isLoading = false;
          });
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          console.error('HLS error:', data);
          if (data.fatal) {
            error = 'Stream error: ' + data.type + ' - ' + data.details;
            isLoading = false;
          }
        });
      } else if (a.canPlayType('application/vnd.apple.mpegurl')) {
        console.log('Using native HLS support');
        a.src = streamUrl;
        a.play().then(() => {
          isLoading = false;
        }).catch(e => {
          console.error('Play error:', e);
          error = 'Failed to start playback: ' + e.message;
          isLoading = false;
        });
      } else {
        error = 'HLS not supported in this browser';
        isLoading = false;
      }
    } else {
      // Direct file playback (local or progressive stream)
      console.log(isOffline ? 'Using local file playback' : 'Using direct progressive stream');
      a.src = streamUrl;
      a.play().then(() => {
        isLoading = false;
      }).catch(e => {
        console.error('Play error:', e);
        error = 'Failed to start playback: ' + e.message;
        isLoading = false;
      });
    }
  } catch (e) {
    console.error('loadAndPlay error:', e);
    error = e instanceof Error ? e.message : 'Failed to play';
    isLoading = false;
  }
}

export function getPlayer() {
  return {
    get currentTrack() { return currentTrack; },
    get queue() { return queue; },
    get queueIndex() { return queueIndex; },
    get isPlaying() { return isPlaying; },
    get currentTime() { return currentTime; },
    get duration() { return duration; },
    get volume() { return volume; },
    get isShuffle() { return isShuffle; },
    get repeatMode() { return repeatMode; },
    get isLoading() { return isLoading; },
    get error() { return error; },
    get waveMode() { return waveMode; },
    get isWaveTrack() { return isWaveTrack; },
  };
}

export function play(track: SCTrack, trackList?: SCTrack[]) {
  if (trackList) {
    queue = trackList;
    queueIndex = trackList.indexOf(track);
    if (queueIndex === -1) {
      queue = [track, ...trackList];
      queueIndex = 0;
    }
  } else {
    // Add to queue if not already there
    const idx = queue.findIndex(t => t.id === track.id);
    if (idx !== -1) {
      queueIndex = idx;
    } else {
      queue = [...queue, track];
      queueIndex = queue.length - 1;
    }
  }
  loadAndPlay(track);
}

export function pause() {
  audio?.pause();
}

export function resume() {
  audio?.play();
}

export function togglePlay() {
  if (isPlaying) pause();
  else if (currentTrack) resume();
}

export async function next() {
  if (queue.length === 0) return;

  let nextIdx: number;
  if (isShuffle) {
    nextIdx = Math.floor(Math.random() * queue.length);
  } else {
    nextIdx = queueIndex + 1;
    if (nextIdx >= queue.length) {
      // In wave mode, fetch more tracks
      if (waveMode && currentTrack) {
        await fetchWaveTracks(currentTrack);
        nextIdx = queueIndex + 1;
        if (nextIdx >= queue.length) {
          isPlaying = false;
          clearDiscordRpc();
          return;
        }
      } else if (repeatMode === 'all') {
        nextIdx = 0;
      } else {
        isPlaying = false;
        clearDiscordRpc();
        return;
      }
    }
  }

  queueIndex = nextIdx;
  isWaveTrack = waveMode;
  loadAndPlay(queue[nextIdx]);
}

async function fetchWaveTracks(seedTrack: SCTrack) {
  try {
    const related = await getRelatedTracks(seedTrack.id, 10);
    const existingIds = new Set(queue.map(t => t.id));
    const newTracks = related.filter(
      t => !existingIds.has(t.id) && !waveDisliked.has(t.id) && t.streamable && t.access !== 'blocked'
    );
    if (newTracks.length > 0) {
      queue = [...queue, ...newTracks];
    }
  } catch (e) {
    console.error('[Wave] Failed to fetch tracks:', e);
  }
}

export function prev() {
  if (queue.length === 0) return;

  // If more than 3 seconds into the track, restart it
  if (currentTime > 3) {
    seek(0);
    return;
  }

  let prevIdx = queueIndex - 1;
  if (prevIdx < 0) {
    if (repeatMode === 'all') prevIdx = queue.length - 1;
    else { seek(0); return; }
  }

  queueIndex = prevIdx;
  loadAndPlay(queue[prevIdx]);
}

export function seek(time: number) {
  const a = getOrCreateAudio();
  a.currentTime = time;
  currentTime = time;
}

export function setVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  if (audio) audio.volume = volume;
}

export function addToQueue(track: SCTrack) {
  queue = [...queue, track];
}

export function removeFromQueue(index: number) {
  queue = queue.filter((_, i) => i !== index);
  if (index < queueIndex) queueIndex--;
  else if (index === queueIndex && queueIndex >= queue.length) {
    queueIndex = queue.length - 1;
  }
}

export function clearQueue() {
  queue = [];
  queueIndex = -1;
}

export function toggleShuffle() {
  isShuffle = !isShuffle;
}

export function startWave(seedTracks: SCTrack[]) {
  waveMode = true;
  isWaveTrack = true;
  queue = [...seedTracks];
  queueIndex = 0;
  loadAndPlay(queue[0]);
}

export function stopWave() {
  waveMode = false;
  isWaveTrack = false;
}

export function waveDislike(trackId: number) {
  waveDisliked.add(trackId);
  saveDisliked();
  // Skip to next
  next();
}

export function cycleRepeat() {
  if (repeatMode === 'none') repeatMode = 'all';
  else if (repeatMode === 'all') repeatMode = 'one';
  else repeatMode = 'none';
}
