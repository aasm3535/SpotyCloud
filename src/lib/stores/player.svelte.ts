import type { SCTrack } from '$lib/api/types';
import { getStreamUrl } from '$lib/api/soundcloud';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { readFile } from '@tauri-apps/plugin-fs';
import { isTrackDownloaded, getTrackFilePath } from './downloads.svelte';
import Hls from 'hls.js';
import { connectAudio } from './equalizer.svelte';
import { getRelatedTracks, searchTracks, getTrendingTracks } from '$lib/api/soundcloud';
import { getLikedTracks } from './liked.svelte';
import { loadDataSync, saveData } from '$lib/utils/storage';
import { getSavedPlayerState, savePlayerVolume, savePlayerShuffle, savePlayerRepeat, savePlayerLastTrack } from './settings.svelte';

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

async function updateDiscordRpc(track: SCTrack, playing = true) {
  // Dynamic import to avoid circular dependency
  const { getSettings } = await import('./settings.svelte');
  const settings = getSettings();
  const isEnabled = settings.discordRpcEnabled ?? true;
  const showListenButton = settings.discordShowListenButton ?? true;

  if (!isEnabled) {
    clearDiscordRpc();
    return;
  }

  const artworkUrl = track.artwork_url
    ? track.artwork_url.replace('-large', '-t500x500')
    : null;
  const durationSecs = track.duration ? Math.round(track.duration / 1000) : null;
  const trackUrl = showListenButton ? (track.permalink_url || null) : null;
  invoke('discord_rpc_update', {
    title: track.title,
    artist: track.user.username,
    artworkUrl,
    durationSecs,
    trackUrl,
    isPlaying: playing,
  }).catch((e) => console.warn('[Discord RPC] update failed:', e));
}

function clearDiscordRpc() {
  invoke('discord_rpc_clear').catch((e) => console.warn('[Discord RPC] clear failed:', e));
}

// Load persisted player state
const _saved = getSavedPlayerState();

let currentTrack = $state<SCTrack | null>(null);
let queue = $state<SCTrack[]>([]);
let queueIndex = $state(-1);
let isPlaying = $state(false);
let currentTime = $state(0);
let duration = $state(0);
let volume = $state(_saved.volume);
let isShuffle = $state(_saved.isShuffle);
let repeatMode = $state<'none' | 'all' | 'one'>(_saved.repeatMode);
let isLoading = $state(false);
let error = $state<string | null>(null);
let waveMode = $state(false);
let waveDisliked = $state<Set<number>>(loadDisliked());
let isWaveTrack = $state(false);
let lastSavedTrackId: number | null = _saved.lastTrackId;

// Wave algorithm state
let wavePlayedIds = new Set<number>();       // All tracks played this wave session (memory only for performance)
let waveHistoryIds = new Set<number>(loadWaveHistory());  // Persisted history (last 200 tracks)
let wavePlayedTitles = new Set<string>();    // Track titles to catch reuploads
let waveRecentArtists: number[] = [];         // Recent artist IDs (ring buffer for diversity)
let waveRecentGenres: string[] = [];          // Recent genres for style diversity
let waveSeedIndex = 0;                        // Rotate through liked tracks as seeds
let waveSeedScores = new Map<number, number>(); // Track which seeds give good results
const WAVE_ARTIST_COOLDOWN = 3;               // Min tracks between same artist
const WAVE_GENRE_COOLDOWN = 2;                // Min tracks between same genre
const WAVE_MAX_FETCH_ATTEMPTS = 5;            // Max retries with different seeds
const WAVE_HISTORY_LIMIT = 200;               // Persist last N played tracks
const WAVE_MIN_TRACK_DURATION = 60_000;       // Skip tracks shorter than 60s
const WAVE_MAX_TRACK_DURATION = 600_000;      // Skip tracks longer than 10m

// Normalize title for comparison (removes common reupload patterns)
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\([^)]*\)/g, '') // Remove parentheses and content
    .replace(/\[[^\]]*\]/g, '') // Remove brackets and content
    .replace(/[^\w\s]/g, ' ')   // Replace special chars with space
    .replace(/\s+/g, ' ')       // Collapse multiple spaces
    .trim();
}

function loadDisliked(): Set<number> {
  try {
    const arr = loadDataSync<number[]>('wave_disliked', []);
    return new Set(arr);
  } catch { return new Set(); }
}

function loadWaveHistory(): number[] {
  try {
    return loadDataSync<number[]>('wave_history', []);
  } catch { return []; }
}

function saveWaveHistory() {
  const history = [...waveHistoryIds].slice(-WAVE_HISTORY_LIMIT);
  saveData('wave_history', history);
}

function saveDisliked() {
  saveData('wave_disliked', [...waveDisliked]);
}

function resetWaveSession(fullReset = false) {
  wavePlayedIds = new Set();
  wavePlayedTitles = new Set();
  waveRecentArtists = [];
  waveRecentGenres = [];
  waveSeedIndex = 0;
  if (fullReset) {
    waveHistoryIds = new Set();
    waveSeedScores.clear();
  }
}

function trackArtistPlayed(artistId: number, genre?: string) {
  waveRecentArtists.push(artistId);
  if (waveRecentArtists.length > 20) {
    waveRecentArtists = waveRecentArtists.slice(-20);
  }
  if (genre) {
    trackGenrePlayed(genre);
  }
}

function isArtistOnCooldown(artistId: number): boolean {
  const recent = waveRecentArtists.slice(-WAVE_ARTIST_COOLDOWN);
  return recent.includes(artistId);
}

function trackGenrePlayed(genre: string) {
  if (!genre) return;
  waveRecentGenres.push(genre.toLowerCase());
  if (waveRecentGenres.length > 15) {
    waveRecentGenres = waveRecentGenres.slice(-15);
  }
}

function isGenreOnCooldown(genre: string): boolean {
  if (!genre) return false;
  const recent = waveRecentGenres.slice(-WAVE_GENRE_COOLDOWN);
  return recent.includes(genre.toLowerCase());
}

// Calculate track quality score (0-100)
function calculateTrackScore(track: SCTrack): number {
  let score = 50; // Base score

  // Popularity score (based on likes and plays)
  const likes = track.likes_count || 0;
  const plays = track.playback_count || 1;
  const likeRatio = likes / plays;
  
  // Boost for high like ratio (quality indicator)
  if (likeRatio > 0.05) score += 15;
  else if (likeRatio > 0.02) score += 10;
  else if (likeRatio > 0.01) score += 5;
  
  // Boost for popular tracks (but not too much to keep variety)
  if (likes > 10000) score += 10;
  else if (likes > 1000) score += 5;
  
  // Freshness score - prefer tracks from last 2 years but not brand new
  try {
    const created = new Date(track.created_at);
    const now = new Date();
    const ageYears = (now.getTime() - created.getTime()) / (365 * 24 * 60 * 60 * 1000);
    if (ageYears >= 0.5 && ageYears <= 3) score += 10; // Sweet spot
    else if (ageYears > 3 && ageYears < 7) score += 5; // Older but still good
    else if (ageYears < 0.5) score -= 5; // Too new, might be low quality
  } catch { }
  
  // Duration score - prefer tracks between 2-6 minutes
  const durationMin = track.duration / 60000;
  if (durationMin >= 2 && durationMin <= 6) score += 10;
  else if (durationMin < 1.5 || durationMin > 8) score -= 10;
  
  // Genre diversity bonus
  if (!isGenreOnCooldown(track.genre)) score += 10;
  
  return Math.max(0, Math.min(100, score));
}

// Enhanced scoring with energy boost for Wave mode
function calculateTrackScoreWithEnergy(track: SCTrack): number {
  let score = calculateTrackScore(track);
  
  // Energy boost based on title keywords
  const titleLower = track.title.toLowerCase();
  const energyKeywords = ['energy', 'upbeat', 'fast', 'dance', 'party', 'workout', 
                          'banger', 'bass', 'drop', 'remix', 'edit', 'extended',
                          'mix', 'club', 'festival', 'rave', 'hard', 'intense'];
  
  for (const keyword of energyKeywords) {
    if (titleLower.includes(keyword)) {
      score += 8;
      break; // Only count once
    }
  }
  
  // Boost tracks with higher engagement (likes relative to plays)
  const likes = track.likes_count || 0;
  const plays = track.playback_count || 1;
  const likeRatio = likes / plays;
  
  // Extra boost for viral tracks
  if (likeRatio > 0.08) score += 10;
  else if (likeRatio > 0.05) score += 5;
  
  // Prefer medium-duration energetic tracks (2.5 - 5 min is sweet spot for energy)
  const durationMin = track.duration / 60000;
  if (durationMin >= 2.5 && durationMin <= 5) score += 8;
  
  return Math.max(0, Math.min(100, score));
}

function updateSeedScore(seedId: number, goodResult: boolean) {
  const current = waveSeedScores.get(seedId) || 0;
  if (goodResult) {
    waveSeedScores.set(seedId, Math.min(10, current + 1));
  } else {
    waveSeedScores.set(seedId, Math.max(-5, current - 1));
  }
}

// Get "second circle" related tracks (related of related)
async function getExtendedRelatedTracks(seedTrack: SCTrack, limit = 15): Promise<SCTrack[]> {
  const related = await getRelatedTracks(seedTrack.id, 10);
  const extended: SCTrack[] = [...related];
  
  // Get related from 2 random related tracks
  const shuffled = [...related].sort(() => Math.random() - 0.5).slice(0, 2);
  for (const track of shuffled) {
    try {
      const secondLevel = await getRelatedTracks(track.id, 8);
      extended.push(...secondLevel);
    } catch (e) {
      console.warn('[Wave] Failed to get extended related for:', track.title);
    }
  }
  
  return extended.slice(0, limit);
}

// Search for energetic tracks by genre
async function searchEnergeticTracks(genre: string, limit = 10): Promise<SCTrack[]> {
  try {
    const energeticKeywords = ['energy', 'upbeat', 'dance', 'party', 'workout', 'fast'];
    const keyword = energeticKeywords[Math.floor(Math.random() * energeticKeywords.length)];
    const query = `${genre} ${keyword}`;
    const result = await searchTracks(query, limit);
    return result.collection;
  } catch (e) {
    console.warn('[Wave] Failed to search energetic tracks:', e);
    return [];
  }
}

// Pick a seed track for fetching related tracks — smart rotation with score weighting
function pickWaveSeed(): SCTrack | null {
  const liked = getLikedTracks();
  const likedTracks = liked.tracks;

  // Build seed pool: liked tracks + recent queue tracks (for variety)
  const seedPool: SCTrack[] = [];

  // Add shuffled liked tracks
  if (likedTracks.length > 0) {
    const shuffled = [...likedTracks].sort(() => Math.random() - 0.5);
    seedPool.push(...shuffled);
  }

  // Add recent queue tracks that aren't in liked (they bring fresh recommendations)
  const likedIds = new Set(liked.ids);
  const recentQueue = queue.slice(Math.max(0, queueIndex - 5), queueIndex + 1);
  for (const t of recentQueue) {
    if (!likedIds.has(t.id)) seedPool.push(t);
  }

  if (seedPool.length === 0) return null;

  // Weight seeds by their score (successful seeds get priority)
  const weighted = seedPool.map(seed => ({
    seed,
    weight: Math.exp((waveSeedScores.get(seed.id) || 0) * 0.3) // Exponential weighting
  }));

  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  let random = Math.random() * totalWeight;

  for (const { seed, weight } of weighted) {
    random -= weight;
    if (random <= 0) return seed;
  }

  return seedPool[0];
}

let audio: HTMLAudioElement | null = null;
let hls: Hls | null = null;

let rafId: number | null = null;

function startTimeUpdates() {
  if (rafId) return;
  
  function updateLoop() {
    if (audio && isPlaying) {
      currentTime = audio.currentTime;
      rafId = requestAnimationFrame(updateLoop);
    }
  }
  
  rafId = requestAnimationFrame(updateLoop);
}

function stopTimeUpdates() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

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
      stopTimeUpdates();
    });
    audio.addEventListener('play', () => { 
      isPlaying = true; 
      startTimeUpdates();
    });
    audio.addEventListener('pause', () => { 
      isPlaying = false; 
      stopTimeUpdates();
    });
    audio.addEventListener('error', (e) => {
      console.error('Audio error:', e);
      error = 'Playback error: ' + (audio?.error?.message || 'Unknown error');
      isPlaying = false;
      isLoading = false;
      stopTimeUpdates();
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
  lastSavedTrackId = track.id;
  await savePlayerLastTrack(track.id);
  updateMediaSession();
  await updateDiscordRpc(track);

  // Track history for wave mode diversity
  if (waveMode) {
    wavePlayedIds.add(track.id);
    wavePlayedTitles.add(normalizeTitle(track.title));
    waveHistoryIds.add(track.id);
    // Keep history size in check
    if (waveHistoryIds.size > WAVE_HISTORY_LIMIT) {
      const arr = [...waveHistoryIds];
      waveHistoryIds = new Set(arr.slice(-WAVE_HISTORY_LIMIT));
    }
    saveWaveHistory();
    trackArtistPlayed(track.user.id, track.genre);
  }

  try {
    console.log('Loading track:', track.title, 'ID:', track.id);
    
    // Check if track is available offline
    const isOffline = isTrackDownloaded(track.id);
    const localPath = getTrackFilePath(track.id);
    
    let streamUrl: string;
    
    // Check if it's a local imported track (negative ID)
    if (track.id < 0 && track.stream_url) {
      console.log('Playing local imported track:', track.title, 'URL:', track.stream_url.substring(0, 50) + '...');
      // Check if URL is valid (starts with blob: or file://)
      if (!track.stream_url.startsWith('blob:') && !track.stream_url.startsWith('file://')) {
        console.error('Invalid stream URL for local track:', track.stream_url);
        throw new Error('Invalid local track URL');
      }
      streamUrl = track.stream_url;
    } else if (isOffline && localPath) {
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
    get lastSavedTrackId() { return lastSavedTrackId; },
  };
}

export function play(track: SCTrack, trackList?: SCTrack[]) {
  // Playing something manually stops wave mode
  waveMode = false;
  isWaveTrack = false;

  if (trackList) {
    queue = trackList;
    queueIndex = trackList.indexOf(track);
    if (queueIndex === -1) {
      queue = [track, ...trackList];
      queueIndex = 0;
    }
  } else {
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
  // Update Discord RPC to show paused state (no timestamps = no progress bar)
  if (currentTrack) {
    updateDiscordRpc(currentTrack, false);
  }
}

export function resume() {
  audio?.play();
  // Update Discord RPC to show playing state with timestamps
  if (currentTrack) {
    updateDiscordRpc(currentTrack, true);
  }
}

export function togglePlay() {
  if (isPlaying) {
    pause();
  } else if (currentTrack) {
    resume();
  }
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

async function fetchWaveTracks(_seedTrack: SCTrack) {
  const existingIds = new Set(queue.map(t => t.id));
  let seedUsed: SCTrack | null = null;
  const allCandidates: SCTrack[] = [];

  for (let attempt = 0; attempt < WAVE_MAX_FETCH_ATTEMPTS; attempt++) {
    try {
      const seed = pickWaveSeed();
      if (!seed) {
        console.warn('[Wave] No seed tracks available');
        return;
      }
      seedUsed = seed;

      console.log(`[Wave] Fetching tracks (attempt ${attempt + 1}) seed: "${seed.title}" by ${seed.user.username}`);
      
      // Collect from multiple sources for variety
      const sources: SCTrack[][] = [];
      
      // Source 1: Extended related (related + related of related)
      try {
        const extended = await getExtendedRelatedTracks(seed, 25);
        sources.push(extended);
        console.log(`[Wave] Got ${extended.length} extended related tracks`);
      } catch (e) {
        console.warn('[Wave] Failed to get extended related');
      }
      
      // Source 2: Direct related
      try {
        const related = await getRelatedTracks(seed.id, 20);
        sources.push(related);
        console.log(`[Wave] Got ${related.length} direct related tracks`);
      } catch (e) {
        console.warn('[Wave] Failed to get related tracks');
      }
      
      // Source 3: Energetic tracks by genre
      if (seed.genre) {
        try {
          const energetic = await searchEnergeticTracks(seed.genre, 15);
          sources.push(energetic);
          console.log(`[Wave] Got ${energetic.length} energetic tracks`);
        } catch (e) {
          console.warn('[Wave] Failed to search energetic tracks');
        }
      }
      
      // Combine all sources
      const combined = sources.flat();
      console.log(`[Wave] Total candidates from all sources: ${combined.length}`);

      // Filter: no duplicates (by ID or title), no disliked, no already-played (session + history), streamable, good duration
      const candidates = combined.filter(t => {
        const normalizedTitle = normalizeTitle(t.title);
        const titleDuplicate = wavePlayedTitles.has(normalizedTitle);
        
        return !existingIds.has(t.id) &&
          !wavePlayedIds.has(t.id) &&
          !waveHistoryIds.has(t.id) &&
          !waveDisliked.has(t.id) &&
          !titleDuplicate &&
          t.streamable &&
          t.access !== 'blocked' &&
          t.duration >= WAVE_MIN_TRACK_DURATION &&
          t.duration <= WAVE_MAX_TRACK_DURATION;
      });

      console.log(`[Wave] After filtering: ${candidates.length} candidates`);

      if (candidates.length === 0) {
        updateSeedScore(seed.id, false);
        console.log('[Wave] No candidates from this seed, trying another...');
        continue;
      }

      // Enhanced scoring with energy boost
      const scored = candidates.map(t => ({
        track: t,
        score: calculateTrackScoreWithEnergy(t),
        onCooldown: isArtistOnCooldown(t.user.id) || isGenreOnCooldown(t.genre),
        source: 'mixed'
      }));

      // Sort by score, but boost non-cooldown tracks
      scored.sort((a, b) => {
        const boostA = a.onCooldown ? 0 : 20;
        const boostB = b.onCooldown ? 0 : 20;
        return (b.score + boostB) - (a.score + boostA);
      });

      // Take top tracks with diversity enforcement
      const newTracks: SCTrack[] = [];
      const usedArtists = new Set<number>();
      const usedGenres = new Set<string>();

      for (const { track, onCooldown } of scored) {
        if (newTracks.length >= 10) break; // Increased from 8 to 10
        
        // Enforce diversity: max 2 tracks per artist, max 2 per genre in this batch
        const artistCount = [...usedArtists].filter(id => id === track.user.id).length;
        const genreCount = track.genre ? [...usedGenres].filter(g => g === track.genre.toLowerCase()).length : 0;
        
        if (artistCount < 2 && (genreCount < 2 || !track.genre)) {
          newTracks.push(track);
          usedArtists.add(track.user.id);
          if (track.genre) usedGenres.add(track.genre.toLowerCase());
        }
      }

      if (newTracks.length > 0) {
        queue = [...queue, ...newTracks];
        // Mark them in existing set for next iteration and track titles
        for (const t of newTracks) {
          existingIds.add(t.id);
          wavePlayedTitles.add(normalizeTitle(t.title));
        }
        // Mark seed as successful
        updateSeedScore(seed.id, true);
        
        const avgScore = Math.round(newTracks.reduce((sum, t) => sum + calculateTrackScoreWithEnergy(t), 0) / newTracks.length);
        console.log(`[Wave] Added ${newTracks.length} energetic tracks (avg quality: ${avgScore}/100)`);
        return;
      }

      updateSeedScore(seed.id, false);
      console.log('[Wave] No suitable tracks from this seed, trying another...');
    } catch (e) {
      console.error(`[Wave] Fetch attempt ${attempt + 1} failed:`, e);
      if (seedUsed) updateSeedScore(seedUsed.id, false);
    }
  }

  console.warn('[Wave] All fetch attempts exhausted');
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

export async function setVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  if (audio) audio.volume = volume;
  await savePlayerVolume(volume);
}

let savedVolume = $state(volume);

export async function toggleMute() {
  if (volume > 0) {
    savedVolume = volume;
    await setVolume(0);
  } else {
    await setVolume(savedVolume || 0.7);
  }
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

export async function toggleShuffle() {
  isShuffle = !isShuffle;
  await savePlayerShuffle(isShuffle);
}

export function startWave(seedTracks: SCTrack[]) {
  // Reset wave session tracking but keep history
  resetWaveSession(false);

  waveMode = true;
  isWaveTrack = true;
  queue = [...seedTracks];
  queueIndex = 0;
  loadAndPlay(queue[0]);
}

export function stopWave() {
  waveMode = false;
  isWaveTrack = false;
  resetWaveSession();
}

export function waveDislike(trackId: number) {
  waveDisliked.add(trackId);
  saveDisliked();
  // Skip to next
  next();
}

export async function cycleRepeat() {
  if (repeatMode === 'none') repeatMode = 'all';
  else if (repeatMode === 'all') repeatMode = 'one';
  else repeatMode = 'none';
  await savePlayerRepeat(repeatMode);
}
