import type { SCTrack, SCSearchResult, SCTranscoding } from './types';
import { fetch } from '@tauri-apps/plugin-http';

const API_BASE = 'https://api-v2.soundcloud.com';

let clientId: string | null = null;

export function setApiClientId(id: string) {
  clientId = id;
}

export function getApiClientId(): string | null {
  return clientId;
}

async function apiFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  if (!clientId) throw new Error('client_id not set');

  const url = new URL(`${API_BASE}${endpoint}`);
  url.searchParams.set('client_id', clientId);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    if (res.status === 401) throw new Error('Invalid client_id');
    if (res.status === 429) throw new Error('Rate limited — try again later');
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

export async function testConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    if (!clientId) return { success: false, error: 'Client ID not set' };
    
    const url = new URL(`${API_BASE}/search/tracks`);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('q', 'test');
    url.searchParams.set('limit', '1');
    
    console.log('Testing connection with URL:', url.toString().replace(clientId, '***'));
    
    const res = await fetch(url.toString());
    
    console.log('Response status:', res.status);
    
    if (res.ok) {
      return { success: true };
    } else {
      const text = await res.text();
      console.error('Error response:', text);
      return { success: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
  } catch (e) {
    console.error('Connection error:', e);
    return { success: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

export async function searchTracks(query: string, limit = 20, offset = 0): Promise<SCSearchResult<SCTrack>> {
  return apiFetch<SCSearchResult<SCTrack>>('/search/tracks', {
    q: query,
    limit: String(limit),
    offset: String(offset),
  });
}

export async function getTrack(trackId: number): Promise<SCTrack> {
  return apiFetch<SCTrack>(`/tracks/${trackId}`);
}

export async function getStreamUrl(track: SCTrack): Promise<string> {
  const transcodings = track.media?.transcodings ?? [];
  
  console.log('Available transcodings:', transcodings.map(t => ({ protocol: t.format.protocol, mime: t.format.mime_type })));

  // Prefer progressive (direct file) over HLS for better CORS compatibility
  const preferred = transcodings.find(
    (t: SCTranscoding) => t.format.protocol === 'progressive' && t.format.mime_type.includes('mpeg')
  ) ?? transcodings.find(
    (t: SCTranscoding) => t.format.protocol === 'progressive'
  ) ?? transcodings.find(
    (t: SCTranscoding) => t.format.protocol === 'hls'
  ) ?? transcodings[0];

  if (!preferred) throw new Error('No stream available for this track');

  console.log('Selected transcoding:', preferred.format.protocol, preferred.format.mime_type);

  // Resolve the transcoding URL to get the actual stream URL
  const url = new URL(preferred.url);
  url.searchParams.set('client_id', clientId!);
  console.log('Fetching stream from:', url.toString().replace(clientId!, '***'));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Failed to get stream URL');
  const data: { url: string } = await res.json();
  console.log('Got stream URL:', data.url.substring(0, 80) + '...');
  return data.url;
}

export async function getRelatedTracks(trackId: number, limit = 10): Promise<SCTrack[]> {
  const result = await apiFetch<SCSearchResult<SCTrack>>(`/tracks/${trackId}/related`, {
    limit: String(limit),
  });
  return result.collection;
}

export async function getUserTracks(userId: number, limit = 10): Promise<SCTrack[]> {
  const result = await apiFetch<SCSearchResult<SCTrack>>(`/users/${userId}/tracks`, {
    limit: String(limit),
  });
  return result.collection;
}

export async function getTrendingTracks(genre?: string, limit = 20): Promise<SCTrack[]> {
  const params: Record<string, string> = {
    limit: String(limit),
    kind: 'trending',
  };
  if (genre) params.genre = `soundcloud:genres:${genre}`;
  const result = await apiFetch<SCSearchResult<SCTrack>>('/search/tracks', params);
  return result.collection;
}

export async function fetchNextPage<T>(nextHref: string): Promise<SCSearchResult<T>> {
  if (!clientId) throw new Error('client_id not set');
  const url = new URL(nextHref);
  url.searchParams.set('client_id', clientId);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
