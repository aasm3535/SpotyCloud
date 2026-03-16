import { fetch } from '@tauri-apps/plugin-http';

export interface LyricLine {
  time: number;
  text: string;
}

export interface LyricsData {
  title: string;
  artist: string;
  lines: LyricLine[];
  source: string;
}

const lyricsCache = new Map<string, LyricsData | null>();

/**
 * Cyrillic → Latin transliteration
 */
const cyrillicToLatin: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
  'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
  'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
  'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
  'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
  'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo',
  'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
  'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
  'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch',
  'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya',
};

/**
 * Latin → Cyrillic reverse transliteration (for common words)
 */
const latinToCyrillic: Record<string, string> = {
  'a': 'а', 'b': 'б', 'v': 'в', 'g': 'г', 'd': 'д', 'e': 'е',
  'zh': 'ж', 'z': 'з', 'i': 'и', 'y': 'й', 'k': 'к', 'l': 'л', 'm': 'м',
  'n': 'н', 'o': 'о', 'p': 'п', 'r': 'р', 's': 'с', 't': 'т', 'u': 'у',
  'f': 'ф', 'h': 'х', 'c': 'ц', 'w': 'в', 'j': 'дж', 'x': 'кс',
  'q': 'к', 'ё': 'е',
};

// Common transliterated words that should map to their Russian equivalents
const commonWordMap: Record<string, string> = {
  'overdose': 'овердоз',
  'club': 'клуб',
  'dark': 'дарк',
  'night': 'найт',
  'life': 'лайф',
  'dead': 'дед',
  'love': 'лав',
  'hate': 'хейт',
  'money': 'мани',
  'drug': 'драг',
  'drugs': 'драгс',
  'smoke': 'смоук',
  'heart': 'харт',
  'blood': 'блуд',
  'pain': 'пейн',
  'death': 'дес',
  'dream': 'дрим',
  'trap': 'трэп',
  'flow': 'флоу',
  'rap': 'рэп',
  'wave': 'вэйв',
};

function transliterateToLatin(text: string): string {
  return text.split('').map(c => cyrillicToLatin[c] ?? c).join('');
}

function transliterateToCyrillic(text: string): string {
  // First try whole-word replacements for common words
  let result = text.toLowerCase();
  for (const [latin, cyrillic] of Object.entries(commonWordMap)) {
    result = result.replace(new RegExp(`\\b${latin}\\b`, 'gi'), cyrillic);
  }
  // If nothing changed, do character-by-character
  if (result === text.toLowerCase()) {
    result = text.split('').map(c => latinToCyrillic[c.toLowerCase()] ?? c).join('');
  }
  return result;
}

function hasCyrillic(text: string): boolean {
  return /[а-яА-ЯёЁ]/.test(text);
}

function hasLatin(text: string): boolean {
  return /[a-zA-Z]/.test(text);
}

function transliterate(text: string): string {
  return transliterateToLatin(text);
}

/**
 * Clean SoundCloud-style title junk
 */
function cleanText(text: string): string {
  return text
    .replace(/\s*[\(\[](?:official|audio|video|visualizer|lyrics?|music|hd|hq|4k|prod\.?|ft\.?|feat\.?|remix|edit|mix|live|acoustic|version|original|extended|full|free|download|out now)[^\)\]]*[\)\]]/gi, '')
    .replace(/\s*\|.*$/, '')
    .replace(/[\u{1F600}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1FA00}-\u{1FAFF}]/gu, '')
    .replace(/[♪♫★✦✧♥♡⚡🔥💔]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFeaturedArtist(title: string): string | null {
  const match = title.match(/[\(\[]\s*(?:feat\.?|ft\.?)\s+([^\)\]]+)[\)\]]/i);
  return match ? match[1].trim() : null;
}

/**
 * Generate multiple search queries from a SoundCloud title + uploader.
 */
function buildSearchQueries(title: string, uploader: string): Array<{ track: string; artist: string }> {
  const queries: Array<{ track: string; artist: string }> = [];
  const seen = new Set<string>();

  function addQuery(track: string, artist: string) {
    const t = track.trim();
    const a = artist.trim();
    if (!t || !a) return;
    const key = `${a.toLowerCase()}::${t.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    queries.push({ track: t, artist: a });

    // Cyrillic → Latin transliteration
    if (hasCyrillic(t) || hasCyrillic(a)) {
      const tl = transliterateToLatin(t);
      const al = transliterateToLatin(a);
      const latinKey = `${al.toLowerCase()}::${tl.toLowerCase()}`;
      if (!seen.has(latinKey)) {
        seen.add(latinKey);
        queries.push({ track: tl, artist: al });
      }
    }

    // Latin → Cyrillic reverse transliteration
    if (hasLatin(t) && !hasCyrillic(t)) {
      const tc = transliterateToCyrillic(t);
      const ac = transliterateToCyrillic(a);
      const cyrilKey = `${ac.toLowerCase()}::${tc.toLowerCase()}`;
      if (!seen.has(cyrilKey) && hasCyrillic(tc)) {
        seen.add(cyrilKey);
        queries.push({ track: tc, artist: ac });
      }
    }
  }

  const cleaned = cleanText(title);
  const featArtist = extractFeaturedArtist(title);

  const parts = cleaned.split(/\s+-\s+/).map(p => p.trim()).filter(Boolean);

  if (parts.length >= 3) {
    addQuery(parts[parts.length - 1], parts[parts.length - 2]);
    addQuery(parts.slice(1).join(' - '), parts[0]);
    addQuery(parts[parts.length - 1], parts[0]);
  } else if (parts.length === 2) {
    addQuery(parts[1], parts[0]);
    addQuery(parts[1], uploader);
    addQuery(parts[0], parts[1]);
  } else {
    addQuery(cleaned, uploader);
  }

  if (featArtist) {
    const titleWithoutFeat = cleaned.replace(/[\(\[]\s*(?:feat\.?|ft\.?)\s+[^\)\]]+[\)\]]/i, '').trim();
    const trackParts = titleWithoutFeat.split(/\s+-\s+/);
    const trackName = trackParts[trackParts.length - 1];
    addQuery(trackName, featArtist);
  }

  addQuery(cleaned, uploader);

  return queries;
}

/**
 * Try lrclib /api/search with track_name + artist_name
 */
async function searchByFields(track: string, artist: string): Promise<any[] | null> {
  const url = new URL('https://lrclib.net/api/search');
  url.searchParams.set('track_name', track);
  url.searchParams.set('artist_name', artist);

  const response = await fetch(url.toString());
  if (!response.ok) return null;

  const data = await response.json();
  return Array.isArray(data) && data.length > 0 ? data : null;
}

/**
 * Try lrclib /api/search with just q= (free text)
 */
async function searchByQuery(q: string): Promise<any[] | null> {
  const url = new URL('https://lrclib.net/api/search');
  url.searchParams.set('q', q);

  const response = await fetch(url.toString());
  if (!response.ok) return null;

  const data = await response.json();
  return Array.isArray(data) && data.length > 0 ? data : null;
}

/**
 * Try lrclib /api/get — searches external sources (Musixmatch, Genius etc)
 * Requires exact track signature: track_name, artist_name, album_name, duration
 */
async function getBySignature(track: string, artist: string, album: string, durationSec: number): Promise<any | null> {
  const url = new URL('https://lrclib.net/api/get');
  url.searchParams.set('track_name', track);
  url.searchParams.set('artist_name', artist);
  url.searchParams.set('album_name', album);
  url.searchParams.set('duration', String(durationSec));

  try {
    const response = await fetch(url.toString());
    if (!response.ok) return null;

    const data = await response.json();
    return data && (data.syncedLyrics || data.plainLyrics) ? data : null;
  } catch {
    return null;
  }
}

/**
 * Pick the best result — prefer synced lyrics, then plain
 */
function pickBest(results: any[], preferredDuration?: number): any | null {
  const withSynced = results.filter(r => r.syncedLyrics);
  const withPlain = results.filter(r => r.plainLyrics);

  const candidates = withSynced.length > 0 ? withSynced : withPlain;
  if (candidates.length === 0) return null;

  if (preferredDuration && preferredDuration > 0) {
    const durationSec = preferredDuration / 1000;
    const sorted = [...candidates].sort((a, b) => {
      const diffA = Math.abs((a.duration || 0) - durationSec);
      const diffB = Math.abs((b.duration || 0) - durationSec);
      return diffA - diffB;
    });
    return sorted[0];
  }

  return candidates[0];
}

export async function fetchLyrics(title: string, artist: string, durationMs?: number): Promise<LyricsData | null> {
  const cacheKey = `${title}::${artist}`.toLowerCase();
  if (lyricsCache.has(cacheKey)) {
    return lyricsCache.get(cacheKey) ?? null;
  }

  const queries = buildSearchQueries(title, artist);
  console.log('[Lyrics] Search queries:', queries);
  const durationSec = durationMs ? Math.round(durationMs / 1000) : 0;

  // Strategy 1: Try /api/search with structured fields (track_name + artist_name)
  for (const q of queries) {
    try {
      console.log(`[Lyrics] Strategy 1 - search fields: track="${q.track}" artist="${q.artist}"`);
      const results = await searchByFields(q.track, q.artist);
      if (results) {
        const best = pickBest(results, durationMs);
        if (best) {
          const data = buildResult(best, title, artist);
          lyricsCache.set(cacheKey, data);
          console.log('[Lyrics] ✅ Found via fields:', q);
          return data;
        }
      }
    } catch (e) {
      console.error('[Lyrics] Field search error:', e);
    }
  }

  // Strategy 2: Free-text search with different combinations
  const freeTextQueries = new Set<string>();
  for (const q of queries) {
    freeTextQueries.add(`${q.artist} ${q.track}`);
    freeTextQueries.add(q.track);
    // Reverse: Latin → Cyrillic
    if (hasLatin(q.track) && !hasCyrillic(q.track)) {
      const tc = transliterateToCyrillic(q.track);
      const ac = transliterateToCyrillic(q.artist);
      if (hasCyrillic(tc)) {
        freeTextQueries.add(`${ac} ${tc}`);
        freeTextQueries.add(tc);
      }
    }
  }

  for (const q of freeTextQueries) {
    try {
      console.log(`[Lyrics] Strategy 2 - free text: "${q}"`);
      const results = await searchByQuery(q);
      if (results) {
        const best = pickBest(results, durationMs);
        if (best) {
          const data = buildResult(best, title, artist);
          lyricsCache.set(cacheKey, data);
          console.log('[Lyrics] ✅ Found via q=:', q);
          return data;
        }
      }
    } catch (e) {
      console.error('[Lyrics] Free-text search error:', e);
    }
  }

  // Strategy 3: /api/get — searches external sources (needs album_name + duration)
  if (durationSec > 0) {
    for (const q of queries) {
      try {
        console.log(`[Lyrics] Strategy 3a - /api/get: track="${q.track}" artist="${q.artist}"`);
        const result = await getBySignature(q.track, q.artist, q.track, durationSec);
        if (result) {
          const data = buildResult(result, title, artist);
          lyricsCache.set(cacheKey, data);
          console.log('[Lyrics] ✅ Found via /api/get:', q);
          return data;
        }
        // Try reverse transliteration (Latin → Cyrillic)
        if (hasLatin(q.track) && !hasCyrillic(q.track)) {
          const tc = transliterateToCyrillic(q.track);
          const ac = transliterateToCyrillic(q.artist);
          if (hasCyrillic(tc)) {
            console.log(`[Lyrics] Strategy 3b - /api/get (reverse): track="${tc}" artist="${ac}"`);
            const result2 = await getBySignature(tc, ac, tc, durationSec);
            if (result2) {
              const data = buildResult(result2, title, artist);
              lyricsCache.set(cacheKey, data);
              console.log('[Lyrics] ✅ Found via /api/get (reverse translit):', { track: tc, artist: ac });
              return data;
            }
          }
        }
      } catch (e) {
        console.error('[Lyrics] /api/get error:', e);
      }
    }
  }

  // Strategy 4: Search with significant words from the title
  const words = cleanText(title)
    .split(/\s+-\s+/)
    .join(' ')
    .split(/\s+/)
    .filter(w => w.length > 2);

  if (words.length > 1) {
    try {
      const results = await searchByQuery(words.join(' '));
      if (results) {
        const best = pickBest(results, durationMs);
        if (best) {
          const data = buildResult(best, title, artist);
          lyricsCache.set(cacheKey, data);
          console.log('[Lyrics] Found via words:', words.join(' '));
          return data;
        }
      }
    } catch (e) {
      console.error('[Lyrics] Word search error:', e);
    }
  }

  console.log('[Lyrics] Not found for:', title);
  lyricsCache.set(cacheKey, null);
  return null;
}

function buildResult(track: any, originalTitle: string, originalArtist: string): LyricsData {
  const lines = track.syncedLyrics
    ? parseLRC(track.syncedLyrics)
    : parsePlain(track.plainLyrics);

  return {
    title: track.trackName || originalTitle,
    artist: track.artistName || originalArtist,
    lines,
    source: 'lrclib.net'
  };
}

function parseLRC(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const regex = /\[(\d{2}):(\d{2}\.\d{2,3})\](.*)/g;
  let match;

  while ((match = regex.exec(lrc)) !== null) {
    const min = parseInt(match[1]);
    const sec = parseFloat(match[2]);
    const text = match[3].trim();

    if (text) {
      lines.push({
        time: (min * 60 + sec) * 1000,
        text
      });
    }
  }

  return lines.sort((a, b) => a.time - b.time);
}

function parsePlain(text: string): LyricLine[] {
  return text
    .split('\n')
    .filter(line => line.trim())
    .map((line, i) => ({
      time: i * 4000,
      text: line.trim()
    }));
}

export function getCurrentLine(lines: LyricLine[], timeMs: number): number {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].time <= timeMs) return i;
  }
  return -1;
}
