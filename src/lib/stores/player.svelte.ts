import type { SCTrack } from '$lib/api/types';
import { getStreamUrl } from '$lib/api/soundcloud';
import Hls from 'hls.js';

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
    audio.addEventListener('error', () => {
      error = 'Playback error';
      isPlaying = false;
      isLoading = false;
    });
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

  try {
    const streamUrl = await getStreamUrl(track);
    const a = getOrCreateAudio();

    // Cleanup old HLS instance
    if (hls) {
      hls.destroy();
      hls = null;
    }

    // Check if it's an HLS stream
    if (streamUrl.includes('.m3u8') || streamUrl.includes('hls')) {
      if (Hls.isSupported()) {
        hls = new Hls();
        hls.loadSource(streamUrl);
        hls.attachMedia(a);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          a.play();
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            error = 'Stream error';
            isLoading = false;
          }
        });
      } else if (a.canPlayType('application/vnd.apple.mpegurl')) {
        a.src = streamUrl;
        a.play();
      }
    } else {
      a.src = streamUrl;
      a.play();
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to play';
  } finally {
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

export function next() {
  if (queue.length === 0) return;

  let nextIdx: number;
  if (isShuffle) {
    nextIdx = Math.floor(Math.random() * queue.length);
  } else {
    nextIdx = queueIndex + 1;
    if (nextIdx >= queue.length) {
      if (repeatMode === 'all') nextIdx = 0;
      else { isPlaying = false; return; }
    }
  }

  queueIndex = nextIdx;
  loadAndPlay(queue[nextIdx]);
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

export function cycleRepeat() {
  if (repeatMode === 'none') repeatMode = 'all';
  else if (repeatMode === 'all') repeatMode = 'one';
  else repeatMode = 'none';
}
