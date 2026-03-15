import type { SpotifyTrackEntry } from './csvParser';
import type { SCTrack } from '$lib/api/types';
import { searchTracks } from '$lib/api/soundcloud';

export interface MatchResult {
  spotify: SpotifyTrackEntry;
  soundcloud: SCTrack | null;
  confidence: number; // 0-1
  status: 'found' | 'not_found' | 'searching';
}

/**
 * Search SoundCloud for a Spotify track using artist + title.
 * Returns best match with confidence score.
 */
export async function matchTrack(entry: SpotifyTrackEntry): Promise<MatchResult> {
  try {
    // Search with artist + title
    const query = `${entry.artist} ${entry.name}`;
    const result = await searchTracks(query, 5);

    if (!result.collection || result.collection.length === 0) {
      return { spotify: entry, soundcloud: null, confidence: 0, status: 'not_found' };
    }

    // Score each result
    let bestTrack: SCTrack | null = null;
    let bestScore = 0;

    for (const track of result.collection) {
      if (!track.streamable || track.access === 'blocked') continue;

      const score = calculateMatchScore(entry, track);
      if (score > bestScore) {
        bestScore = score;
        bestTrack = track;
      }
    }

    if (bestTrack && bestScore >= 0.3) {
      return { spotify: entry, soundcloud: bestTrack, confidence: bestScore, status: 'found' };
    }

    return { spotify: entry, soundcloud: null, confidence: 0, status: 'not_found' };
  } catch (e) {
    console.error(`Failed to match "${entry.artist} - ${entry.name}":`, e);
    return { spotify: entry, soundcloud: null, confidence: 0, status: 'not_found' };
  }
}

function calculateMatchScore(entry: SpotifyTrackEntry, track: SCTrack): number {
  const titleA = normalize(entry.name);
  const titleB = normalize(track.title);
  const artistA = normalize(entry.artist);
  const artistB = normalize(track.user.username);
  const trackTitleLower = normalize(track.title);

  let score = 0;

  // Title similarity (0-0.5)
  if (titleB.includes(titleA) || titleA.includes(titleB)) {
    score += 0.5;
  } else {
    const titleSim = similarity(titleA, titleB);
    score += titleSim * 0.5;
  }

  // Artist similarity (0-0.35)
  if (artistB.includes(artistA) || titleB.includes(artistA) || trackTitleLower.includes(artistA)) {
    score += 0.35;
  } else {
    const artistSim = similarity(artistA, artistB);
    score += artistSim * 0.35;
  }

  // Duration match bonus (0-0.15)
  if (entry.durationMs > 0 && track.duration > 0) {
    const diff = Math.abs(entry.durationMs - track.duration);
    if (diff < 3000) score += 0.15;
    else if (diff < 10000) score += 0.1;
    else if (diff < 30000) score += 0.05;
  }

  return Math.min(1, score);
}

function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[\(\)\[\]\{\}]/g, '')
    .replace(/feat\.|ft\.|prod\.|remix|remaster|official|audio|video|lyrics/gi, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Simple bigram similarity (Dice coefficient) */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = new Set<string>();
  for (let i = 0; i < a.length - 1; i++) bigramsA.add(a.slice(i, i + 2));

  let matches = 0;
  for (let i = 0; i < b.length - 1; i++) {
    if (bigramsA.has(b.slice(i, i + 2))) matches++;
  }

  return (2 * matches) / (a.length - 1 + b.length - 1);
}

/**
 * Batch match with concurrency control and progress callback.
 */
export async function batchMatch(
  entries: SpotifyTrackEntry[],
  onProgress: (done: number, total: number, result: MatchResult) => void,
  concurrency = 2,
  delayMs = 500,
): Promise<MatchResult[]> {
  const results: MatchResult[] = [];
  let done = 0;

  for (let i = 0; i < entries.length; i += concurrency) {
    const batch = entries.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(e => matchTrack(e)));

    for (const r of batchResults) {
      results.push(r);
      done++;
      onProgress(done, entries.length, r);
    }

    // Rate limit delay between batches
    if (i + concurrency < entries.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
