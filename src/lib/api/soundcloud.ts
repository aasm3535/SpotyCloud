import type { SCTrack, SCSearchResult, SCTranscoding } from './types';

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

export async function testConnection(): Promise<boolean> {
  try {
    await apiFetch<SCSearchResult<SCTrack>>('/search/tracks', { q: 'test', limit: '1' });
    return true;
  } catch {
    return false;
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
  // Find best transcoding — prefer HLS + AAC (opus as fallback)
  const transcodings = track.media?.transcodings ?? [];

  const preferred = transcodings.find(
    (t: SCTranscoding) => t.format.protocol === 'hls' && t.format.mime_type.includes('mpeg')
  ) ?? transcodings.find(
    (t: SCTranscoding) => t.format.protocol === 'hls'
  ) ?? transcodings[0];

  if (!preferred) throw new Error('No stream available for this track');

  // Resolve the transcoding URL to get the actual stream URL
  const url = new URL(preferred.url);
  url.searchParams.set('client_id', clientId!);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Failed to get stream URL');
  const data: { url: string } = await res.json();
  return data.url;
}

export async function fetchNextPage<T>(nextHref: string): Promise<SCSearchResult<T>> {
  if (!clientId) throw new Error('client_id not set');
  const url = new URL(nextHref);
  url.searchParams.set('client_id', clientId);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
