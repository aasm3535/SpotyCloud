import { fetch } from '@tauri-apps/plugin-http';

export interface LyricLine {
  time: number;
  text: string;
}

export interface LyricsData {
  id: string;
  title: string;
  artist: string;
  lines: LyricLine[];
  source: string;
}

export interface LyricsSearchResult {
  all: LyricsData[];
  bestIndex: number;
}

const lyricsCache = new Map<string, LyricsSearchResult | null>();

const VOTE_API = 'https://symptom-lyrics.xn0tdev.workers.dev';

export interface LyricsScore {
  lyrics_id: string;
  score: number;
  total_votes: number;
}

export interface LyricsVote {
  lyrics_id: string;
  vote: number;
}

export function generateTrackHash(title: string, artist: string): string {
  const str = `${title}::${artist}`.toLowerCase();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

export async function voteLyrics(trackHash: string, lyricsId: string, vote: 1 | -1 | 0): Promise<void> {
  try {
    await fetch(`${VOTE_API}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track_hash: trackHash, lyrics_id: lyricsId, vote }),
    });
  } catch (e) {
    console.error('[Lyrics] Vote failed:', e);
  }
}

export async function getLyricsScores(trackHash: string): Promise<{ scores: LyricsScore[]; my_votes: LyricsVote[] }> {
  try {
    const res = await fetch(`${VOTE_API}/scores?track_hash=${trackHash}`);
    if (!res.ok) return { scores: [], my_votes: [] };
    const data = await res.json() as { scores?: LyricsScore[]; my_votes?: LyricsVote[] };
    return {
      scores: Array.isArray(data.scores) ? data.scores : [],
      my_votes: Array.isArray(data.my_votes) ? data.my_votes : [],
    };
  } catch {
    return { scores: [], my_votes: [] };
  }
}

// ─── Transliteration tables ───

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

const latinToCyrillic: Record<string, string> = {
  'a': 'а', 'b': 'б', 'v': 'в', 'g': 'г', 'd': 'д', 'e': 'е',
  'zh': 'ж', 'z': 'з', 'i': 'и', 'y': 'й', 'k': 'к', 'l': 'л', 'm': 'м',
  'n': 'н', 'o': 'о', 'p': 'п', 'r': 'р', 's': 'с', 't': 'т', 'u': 'у',
  'f': 'ф', 'h': 'х', 'c': 'ц', 'w': 'в', 'j': 'дж', 'x': 'кс',
  'q': 'к', 'ё': 'е',
};

const commonWordMap: Record<string, string> = {
  'overdose': 'овердоз', 'club': 'клуб', 'dark': 'дарк', 'night': 'найт',
  'life': 'лайф', 'dead': 'дед', 'love': 'лав', 'hate': 'хейт',
  'money': 'мани', 'drug': 'драг', 'drugs': 'драгс', 'smoke': 'смоук',
  'heart': 'харт', 'blood': 'блуд', 'pain': 'пейн', 'death': 'дес',
  'dream': 'дрим', 'trap': 'трэп', 'flow': 'флоу', 'rap': 'рэп',
  'wave': 'вэйв', 'baby': 'бейби', 'style': 'стайл', 'type': 'тайп',
  'beat': 'бит', 'gang': 'гэнг', 'plug': 'плаг', 'ice': 'айс',
  'fire': 'файер', 'cold': 'колд', 'star': 'стар', 'king': 'кинг',
  'queen': 'квин', 'black': 'блэк', 'white': 'вайт', 'red': 'рэд',
  'blue': 'блю', 'green': 'грин', 'gold': 'голд', 'devil': 'дэвил',
  'angel': 'энджел', 'ghost': 'гоуст', 'phantom': 'фантом',
  'flex': 'флекс', 'drip': 'дрип', 'vibe': 'вайб', 'mood': 'муд',
  'speed': 'спид', 'high': 'хай', 'low': 'лоу', 'new': 'нью',
};

function transliterateToLatin(text: string): string {
  return text.split('').map(c => cyrillicToLatin[c] ?? c).join('');
}

function transliterateToCyrillic(text: string): string {
  let result = text.toLowerCase();
  for (const [latin, cyrillic] of Object.entries(commonWordMap)) {
    result = result.replace(new RegExp(`\\b${latin}\\b`, 'gi'), cyrillic);
  }
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

// ─── Text cleaning & normalization ───

const TITLE_NOISE_WORDS = new Set([
  'official', 'audio', 'video', 'visualizer', 'lyrics', 'lyric', 'music',
  'hd', 'hq', '4k', 'prod', 'remix', 'edit', 'mix', 'live', 'acoustic',
  'version', 'original', 'extended', 'full', 'free', 'download', 'out', 'now',
  'clip', 'premiere', 'exclusive', 'snippet', 'teaser', 'preview',
  'type', 'beat', 'instrumental', 'karaoke', 'cover', 'demo',
]);

const TOKEN_STOP_WORDS = new Set([
  'the', 'and', 'feat', 'ft', 'official', 'audio', 'video', 'lyrics', 'lyric',
  'music', 'prod', 'version', 'original', 'a', 'an', 'of', 'in', 'on', 'by',
  'with', 'for', 'to', 'from', 'at', 'is', 'it', 'my', 'me', 'we', 'us',
]);

function cleanText(text: string): string {
  return text
    // Remove parenthetical noise: (Official Audio), [Prod. by X], etc.
    .replace(/\s*[\(\[]\s*(?:official|audio|video|visualizer|lyrics?|music|hd|hq|4k|prod\.?\s*(?:by\s+)?[^\)\]]*|ft\.?\s+[^\)\]]*|feat\.?\s+[^\)\]]*|remix|edit|mix|live|acoustic|version|original|extended|full|free|download|out\s*now|clip|premiere|exclusive|snippet|type\s+beat)[^\)\]]*[\)\]]/gi, '')
    // Remove trailing pipe content
    .replace(/\s*\|.*$/, '')
    // Remove emoji
    .replace(/[\u{1F600}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1FA00}-\u{1FAFF}]/gu, '')
    .replace(/[♪♫★✦✧♥♡⚡🔥💔❤️💜💛💙💚🖤🤍💕💗💓💞💘🎵🎶🎤🎧🎸🎹🎺🎻🥁]/g, '')
    // Remove quotes wrapping the whole title
    .replace(/^["'«»„"]+|["'«»„"]+$/g, '')
    // Remove hashtags
    .replace(/#\w+/g, '')
    // Remove track numbers like "01.", "1)", "Track 1"
    .replace(/^(?:\d{1,3}[\.\)\-]\s*|track\s*\d+[\.\-\s]*)/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeForCompare(text: string): string {
  return cleanText(text)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['`"«»„"]/g, '')
    .replace(/\b(?:feat|ft)\.?\s+[^\-;,()[\]]+/gi, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  return normalizeForCompare(text)
    .split(/[\s-]+/)
    .map(token => token.trim())
    .filter(token => token.length > 1 && !TOKEN_STOP_WORDS.has(token));
}

// ─── Fuzzy matching (Levenshtein) ───

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Use two rows instead of full matrix for memory efficiency
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,       // deletion
        curr[j - 1] + 1,   // insertion
        prev[j - 1] + cost  // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[b.length];
}

function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function fuzzyTokenMatch(token: string, candidates: Set<string>): number {
  if (candidates.has(token)) return 1;

  let best = 0;
  for (const candidate of candidates) {
    // Quick length check — skip if too different
    if (Math.abs(token.length - candidate.length) > 3) continue;

    // Check prefix match (common in transliterations)
    const minLen = Math.min(token.length, candidate.length);
    if (minLen >= 3) {
      const prefixLen = Math.min(3, minLen);
      if (token.slice(0, prefixLen) === candidate.slice(0, prefixLen)) {
        best = Math.max(best, stringSimilarity(token, candidate));
        continue;
      }
    }

    // Check if one contains the other
    if (token.includes(candidate) || candidate.includes(token)) {
      best = Math.max(best, 0.8);
      continue;
    }

    const sim = stringSimilarity(token, candidate);
    if (sim > 0.7) {
      best = Math.max(best, sim);
    }
  }
  return best;
}

// ─── Scoring ───

function tokenOverlapScore(expected: string, actual: string): number {
  const expectedTokens = tokenize(expected);
  const actualTokens = new Set(tokenize(actual));

  if (expectedTokens.length === 0 || actualTokens.size === 0) return 0;

  let totalScore = 0;
  for (const token of expectedTokens) {
    totalScore += fuzzyTokenMatch(token, actualTokens);
  }

  return totalScore / expectedTokens.length;
}

function textSimilarity(expected: string, actual: string): number {
  const ne = normalizeForCompare(expected);
  const na = normalizeForCompare(actual);

  if (!ne || !na) return 0;
  if (ne === na) return 1;

  // One contains the other — very likely a match
  if (ne.includes(na) || na.includes(ne)) {
    const ratio = Math.min(ne.length, na.length) / Math.max(ne.length, na.length);
    return 0.8 + ratio * 0.15;
  }

  // Try transliteration comparison
  if (hasCyrillic(ne) !== hasCyrillic(na)) {
    const neLatin = hasCyrillic(ne) ? transliterateToLatin(ne) : ne;
    const naLatin = hasCyrillic(na) ? transliterateToLatin(na) : na;
    if (neLatin === naLatin) return 0.95;
    const translitSim = stringSimilarity(neLatin, naLatin);
    if (translitSim > 0.85) return translitSim * 0.95;
  }

  // Full string Levenshtein
  const fullSim = stringSimilarity(ne, na);
  if (fullSim > 0.85) return fullSim;

  // Token overlap with fuzzy matching
  const tokenScore = tokenOverlapScore(expected, actual);

  return Math.max(fullSim, tokenScore);
}

function artistVariants(text: string): string[] {
  const normalized = normalizeForCompare(text);
  if (!normalized) return [];

  return normalized
    .split(/\s*(?:,|&|x|\bvs\.?\b|\band\b)\s*/i)
    .map(part => part.trim())
    .filter(Boolean);
}

function artistSimilarity(expected: string, actual: string): number {
  const expectedVariants = artistVariants(expected);
  const actualVariants = artistVariants(actual);

  if (expectedVariants.length === 0 || actualVariants.length === 0) return 0;

  // Exact full match
  const ne = normalizeForCompare(expected);
  const na = normalizeForCompare(actual);
  if (ne === na) return 1;

  // Transliteration match
  if (hasCyrillic(ne) !== hasCyrillic(na)) {
    const neLatin = hasCyrillic(ne) ? transliterateToLatin(ne) : ne;
    const naLatin = hasCyrillic(na) ? transliterateToLatin(na) : na;
    if (neLatin === naLatin) return 0.95;
  }

  // Best variant-to-variant match
  let best = 0;
  for (const ev of expectedVariants) {
    for (const av of actualVariants) {
      const sim = textSimilarity(ev, av);
      best = Math.max(best, sim);
      // Also try transliterated comparison
      if (hasCyrillic(ev) || hasCyrillic(av)) {
        const evl = transliterateToLatin(ev);
        const avl = transliterateToLatin(av);
        best = Math.max(best, stringSimilarity(evl, avl));
      }
    }
  }

  return best;
}

function durationSimilarity(preferredDurationMs: number | undefined, resultDurationSec: number | undefined): number {
  if (!preferredDurationMs || preferredDurationMs <= 0 || !resultDurationSec || resultDurationSec <= 0) {
    return 0.5;
  }

  const diffSec = Math.abs(resultDurationSec - preferredDurationMs / 1000);
  if (diffSec <= 2) return 1;
  if (diffSec <= 5) return 0.9;
  if (diffSec <= 10) return 0.75;
  if (diffSec <= 20) return 0.55;
  if (diffSec <= 35) return 0.3;
  return 0;
}

function scoreResult(
  result: any,
  expectedTrack: string,
  expectedArtist: string,
  preferredDurationMs?: number
): number {
  const trackName = result.trackName || result.name || '';
  const artistName = result.artistName || result.artist || '';
  const titleScore = textSimilarity(expectedTrack, trackName);
  const artistScore = artistSimilarity(expectedArtist, artistName);
  const durationScore = durationSimilarity(preferredDurationMs, result.duration);
  const syncedBonus = result.syncedLyrics ? 0.05 : 0;

  return titleScore * 0.55 + artistScore * 0.3 + durationScore * 0.15 + syncedBonus;
}

function scoreResultForArtists(
  result: any,
  expectedTrack: string,
  expectedArtists: string[],
  preferredDurationMs?: number
): number {
  const candidates = expectedArtists.filter(Boolean);
  if (candidates.length === 0) {
    return scoreResult(result, expectedTrack, '', preferredDurationMs);
  }

  let best = 0;
  for (const artist of candidates) {
    best = Math.max(best, scoreResult(result, expectedTrack, artist, preferredDurationMs));
  }

  return best;
}

function extractFeaturedArtist(title: string): string | null {
  const match = title.match(/[\(\[]\s*(?:feat\.?|ft\.?)\s+([^\)\]]+)[\)\]]/i)
    || title.match(/(?:feat\.?|ft\.?)\s+(.+?)(?:\s*[-\|]|$)/i);
  return match ? match[1].trim() : null;
}

// ─── Title parsing — handles many SoundCloud formats ───

interface ParsedTitle {
  artists: string[];
  track: string;
}

function parseSoundCloudTitle(rawTitle: string): ParsedTitle[] {
  const cleaned = cleanText(rawTitle);
  const results: ParsedTitle[] = [];
  const seen = new Set<string>();

  function add(artists: string[], track: string) {
    const t = track.trim();
    if (!t) return;
    const a = artists.map(x => x.trim()).filter(Boolean);
    const key = `${a.join('|').toLowerCase()}::${t.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push({ artists: a, track: t });
  }

  // Extract featured artist
  const featArtist = extractFeaturedArtist(cleaned);
  const withoutFeat = cleaned
    .replace(/[\(\[]\s*(?:feat\.?|ft\.?)\s+[^\)\]]+[\)\]]/i, '')
    .replace(/\s+(?:feat\.?|ft\.?)\s+.+?(?=\s*[-\|]|$)/i, '')
    .trim();

  // Try different separator patterns
  const separators = [' - ', ' — ', ' – ', ' ~ ', ' // ', ' | '];

  for (const sep of separators) {
    const parts = withoutFeat.split(sep).map(p => p.trim()).filter(Boolean);

    if (parts.length >= 3) {
      // "Producer - Artist - Track" or "Artist - Producer - Track"
      add([parts[0], parts[1]], parts[parts.length - 1]);
      add([parts[0]], parts.slice(1).join(' - '));
      add([parts[1]], parts[parts.length - 1]);
      add([parts[parts.length - 2]], parts[parts.length - 1]);
    } else if (parts.length === 2) {
      // "Artist - Track" (most common)
      add([parts[0]], parts[1]);
      // Maybe reversed: "Track - Artist"
      add([parts[1]], parts[0]);
    }
  }

  // Handle "Artist x Artist - Track" format
  const xMatch = withoutFeat.match(/^(.+?)\s*[xх×]\s*(.+?)\s*[-—–]\s*(.+)$/i);
  if (xMatch) {
    add([xMatch[1], xMatch[2]], xMatch[3]);
    add([xMatch[1]], xMatch[3]);
    add([xMatch[2]], xMatch[3]);
  }

  // Handle "Track (prod. Producer)" or "Track [prod. by Producer]"
  const prodMatch = withoutFeat.match(/^(.+?)\s*[\(\[]\s*prod\.?\s*(?:by\s+)?(.+?)[\)\]](.*)$/i);
  if (prodMatch) {
    const track = (prodMatch[1] + prodMatch[3]).trim();
    add([prodMatch[2]], track);
  }

  // No separator found — use whole thing as track
  if (results.length === 0) {
    add([], withoutFeat);
  }

  // Add featured artist as additional artist to all entries
  if (featArtist) {
    const extra: ParsedTitle[] = [];
    for (const r of results) {
      if (!r.artists.some(a => a.toLowerCase() === featArtist.toLowerCase())) {
        extra.push({ artists: [...r.artists, featArtist], track: r.track });
        extra.push({ artists: [featArtist], track: r.track });
      }
    }
    for (const e of extra) add(e.artists, e.track);
  }

  return results;
}

// ─── Query building ───

function buildSearchQueries(title: string, artists: string[]): Array<{ track: string; artist: string }> {
  const queries: Array<{ track: string; artist: string }> = [];
  const seen = new Set<string>();
  const allArtists = artists.map(a => a.trim()).filter(Boolean);

  function addQuery(track: string, artist: string) {
    const t = track.trim();
    const a = artist.trim();
    if (!t) return;
    // Allow empty artist for some queries
    const key = `${a.toLowerCase()}::${t.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (a) queries.push({ track: t, artist: a });

    // Add transliterated variants
    if (hasCyrillic(t) || hasCyrillic(a)) {
      const tl = transliterateToLatin(t);
      const al = a ? transliterateToLatin(a) : '';
      const latinKey = `${al.toLowerCase()}::${tl.toLowerCase()}`;
      if (!seen.has(latinKey) && al) {
        seen.add(latinKey);
        queries.push({ track: tl, artist: al });
      }
    }

    if (hasLatin(t) && !hasCyrillic(t)) {
      const tc = transliterateToCyrillic(t);
      const ac = a ? transliterateToCyrillic(a) : '';
      const cyrilKey = `${ac.toLowerCase()}::${tc.toLowerCase()}`;
      if (!seen.has(cyrilKey) && hasCyrillic(tc) && ac) {
        seen.add(cyrilKey);
        queries.push({ track: tc, artist: ac });
      }
    }
  }

  // Parse the title to extract artist/track combinations
  const parsed = parseSoundCloudTitle(title);

  for (const p of parsed) {
    // Use parsed artists
    for (const a of p.artists) {
      addQuery(p.track, a);
    }
    // Combine with provided artists
    for (const a of allArtists) {
      addQuery(p.track, a);
    }
  }

  // Also try raw cleaned title with each artist
  const cleaned = cleanText(title);
  for (const a of allArtists) {
    addQuery(cleaned, a);
  }

  // Compact version — remove noise words from the track
  const compactTrack = cleaned
    .split(/\s+/)
    .filter(word => {
      const nw = normalizeForCompare(word);
      return nw.length > 1 && !TITLE_NOISE_WORDS.has(nw);
    })
    .join(' ');
  if (compactTrack && compactTrack !== cleaned) {
    for (const a of allArtists) {
      addQuery(compactTrack, a);
    }
  }

  return queries;
}

// ─── API calls ───

async function searchByFields(track: string, artist: string): Promise<any[] | null> {
  const url = new URL('https://lrclib.net/api/search');
  url.searchParams.set('track_name', track);
  url.searchParams.set('artist_name', artist);

  const response = await fetch(url.toString());
  if (!response.ok) return null;

  const data = await response.json();
  return Array.isArray(data) && data.length > 0 ? data : null;
}

async function searchByQuery(q: string): Promise<any[] | null> {
  const url = new URL('https://lrclib.net/api/search');
  url.searchParams.set('q', q);

  const response = await fetch(url.toString());
  if (!response.ok) return null;

  const data = await response.json();
  return Array.isArray(data) && data.length > 0 ? data : null;
}

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

// ─── Safe concurrent fetch with deduplication ───

async function fetchAllParallel<T>(
  tasks: Array<{ key: string; fn: () => Promise<T | null> }>
): Promise<Map<string, T>> {
  const deduped = new Map<string, () => Promise<T | null>>();
  for (const task of tasks) {
    if (!deduped.has(task.key)) {
      deduped.set(task.key, task.fn);
    }
  }

  const entries = [...deduped.entries()];
  // Run in batches of 4 to avoid rate limiting
  const batchSize = 4;
  const resultMap = new Map<string, T>();

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async ([key, fn]) => {
        const result = await fn();
        return { key, result };
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.result !== null) {
        resultMap.set(r.value.key, r.value.result);
      }
    }

    // If we already have good results, skip remaining batches
    if (resultMap.size >= 3 && i + batchSize < entries.length) {
      // Still do one more batch for better coverage
      continue;
    }
  }

  return resultMap;
}

// ─── Result picking ───

function rankAllResults(
  allResults: any[],
  expectedTrack: string,
  expectedArtists: string[],
  preferredDuration?: number,
  minimumScore = 0.48
): any[] {
  if (allResults.length === 0) return [];

  // Deduplicate by trackName + artistName
  const deduped = new Map<string, any>();
  for (const r of allResults) {
    const key = `${(r.trackName || '').toLowerCase()}::${(r.artistName || '').toLowerCase()}::${r.duration || 0}`;
    if (!deduped.has(key)) {
      deduped.set(key, r);
    }
  }

  const candidates = [...deduped.values()];

  // Score all candidates
  const scored = candidates
    .map(candidate => ({
      candidate,
      score: scoreResultForArtists(candidate, expectedTrack, expectedArtists, preferredDuration),
      hasSynced: !!candidate.syncedLyrics,
      hasPlain: !!candidate.plainLyrics,
    }))
    .filter(s => (s.hasSynced || s.hasPlain) && s.score >= minimumScore)
    .sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (Math.abs(scoreDiff) < 0.05) {
        if (a.hasSynced !== b.hasSynced) return a.hasSynced ? -1 : 1;
      }
      return scoreDiff;
    });

  if (scored.length > 0) {
    const best = scored[0];
    console.log(`[Lyrics] Best score: ${best.score.toFixed(3)}, synced: ${best.hasSynced}, track: "${best.candidate.trackName}", artist: "${best.candidate.artistName}", total candidates: ${scored.length}`);
  }

  return scored.map(s => s.candidate);
}

// ─── Main search function ───

export async function fetchLyrics(
  title: string,
  artist: string,
  durationMs?: number,
  artistCandidates: string[] = []
): Promise<LyricsSearchResult | null> {
  const cacheKey = `${title}::${artist}`.toLowerCase();
  if (lyricsCache.has(cacheKey)) {
    return lyricsCache.get(cacheKey) ?? null;
  }

  const normalizedCandidates = [artist, ...artistCandidates]
    .map(c => c.trim()).filter(Boolean);
  const uniqueArtists = [...new Set(normalizedCandidates.map(c => normalizeForCompare(c)))]
    .map(normalized => normalizedCandidates.find(c => normalizeForCompare(c) === normalized)!)
    .filter(Boolean);

  const primaryArtist = uniqueArtists[0] || artist;
  const queries = buildSearchQueries(title, uniqueArtists);
  console.log('[Lyrics] Search queries:', queries.length, 'for:', title);
  const durationSec = durationMs ? Math.round(durationMs / 1000) : 0;

  const allResults: any[] = [];

  // ═══ Phase 1: Parallel field searches ═══
  const fieldTasks = queries.slice(0, 8).map(q => ({
    key: `fields::${q.track.toLowerCase()}::${q.artist.toLowerCase()}`,
    fn: () => searchByFields(q.track, q.artist),
  }));

  const fieldResults = await fetchAllParallel(fieldTasks);
  for (const results of fieldResults.values()) {
    if (Array.isArray(results)) allResults.push(...results);
  }

  // ═══ Phase 2: Parallel free-text searches ═══
  const freeTextQueries = new Set<string>();
  for (const q of queries) {
    freeTextQueries.add(`${q.artist} ${q.track}`);
    freeTextQueries.add(q.track);

    if (hasLatin(q.track) && !hasCyrillic(q.track)) {
      const tc = transliterateToCyrillic(q.track);
      const ac = transliterateToCyrillic(q.artist);
      if (hasCyrillic(tc)) {
        freeTextQueries.add(`${ac} ${tc}`);
        freeTextQueries.add(tc);
      }
    }
  }

  const words = cleanText(title)
    .split(/\s+-\s+/)
    .join(' ')
    .split(/\s+/)
    .filter(w => {
      const nw = normalizeForCompare(w);
      return nw.length > 2 && !TITLE_NOISE_WORDS.has(nw);
    });
  if (words.length > 1) {
    freeTextQueries.add(words.join(' '));
  }

  const freeTextTasks = [...freeTextQueries].slice(0, 10).map(q => ({
    key: `freetext::${q.toLowerCase()}`,
    fn: () => searchByQuery(q),
  }));

  const freeTextResults = await fetchAllParallel(freeTextTasks);
  for (const results of freeTextResults.values()) {
    if (Array.isArray(results)) allResults.push(...results);
  }

  // ═══ Phase 3: /api/get with signature (parallel) ═══
  if (durationSec > 0) {
    const sigTasks: Array<{ key: string; fn: () => Promise<any | null> }> = [];

    for (const q of queries.slice(0, 6)) {
      sigTasks.push({
        key: `sig::${q.track.toLowerCase()}::${q.artist.toLowerCase()}`,
        fn: () => getBySignature(q.track, q.artist, q.track, durationSec),
      });

      if (hasLatin(q.track) && !hasCyrillic(q.track)) {
        const tc = transliterateToCyrillic(q.track);
        const ac = transliterateToCyrillic(q.artist);
        if (hasCyrillic(tc)) {
          sigTasks.push({
            key: `sig::${tc.toLowerCase()}::${ac.toLowerCase()}`,
            fn: () => getBySignature(tc, ac, tc, durationSec),
          });
        }
      }
    }

    const sigResults = await fetchAllParallel(sigTasks);
    for (const result of sigResults.values()) {
      if (result) allResults.push(result);
    }
  }

  // ═══ Rank all results ═══
  // Best match needs score >= 0.45, alternatives need >= 0.55
  const ranked = rankAllResults(allResults, title, uniqueArtists, durationMs, 0.45);

  if (ranked.length === 0) {
    console.log('[Lyrics] Not found for:', title);
    lyricsCache.set(cacheKey, null);
    return null;
  }

  // Build best + alternatives above stricter threshold
  const bestResult = buildResult(ranked[0], title, primaryArtist);
  const alternatives = rankAllResults(allResults, title, uniqueArtists, durationMs, 0.55)
    .slice(1, 5)
    .map(r => buildResult(r, title, primaryArtist));

  // Deduplicate
  const seenIds = new Set<string>([bestResult.id]);
  const uniqueVariants: LyricsData[] = [bestResult];
  for (const v of alternatives) {
    if (!seenIds.has(v.id)) {
      seenIds.add(v.id);
      uniqueVariants.push(v);
    }
  }

  const result: LyricsSearchResult = { all: uniqueVariants, bestIndex: 0 };
  lyricsCache.set(cacheKey, result);
  console.log(`[Lyrics] Found ${uniqueVariants.length} variants`);
  return result;
}

// ─── Helpers ───

function generateLyricsId(track: any): string {
  const name = (track.trackName || '').toLowerCase();
  const artist = (track.artistName || '').toLowerCase();
  const dur = track.duration || 0;
  let hash = 0;
  const str = `${name}::${artist}::${dur}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function buildResult(track: any, originalTitle: string, originalArtist: string): LyricsData {
  const lines = track.syncedLyrics
    ? parseLRC(track.syncedLyrics)
    : parsePlain(track.plainLyrics);

  return {
    id: generateLyricsId(track),
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
