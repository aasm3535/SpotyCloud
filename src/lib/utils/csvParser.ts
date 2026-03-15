/**
 * Parse Exportify CSV format into track entries for SoundCloud matching.
 * Expected columns: Track Name, Artist Name(s) — others are optional.
 */

export interface SpotifyTrackEntry {
  name: string;
  artist: string;
  album: string;
  durationMs: number;
}

export function parseSpotifyCSV(csvText: string): SpotifyTrackEntry[] {
  const lines = csvText.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Parse header
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());

  const nameIdx = headers.findIndex(h => h === 'track name');
  const artistIdx = headers.findIndex(h => h.includes('artist name'));
  const albumIdx = headers.findIndex(h => h === 'album name');
  const durationIdx = headers.findIndex(h => h.includes('duration'));

  if (nameIdx === -1 || artistIdx === -1) {
    throw new Error('CSV must contain "Track Name" and "Artist Name(s)" columns');
  }

  const tracks: SpotifyTrackEntry[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const name = cols[nameIdx]?.trim();
    const artist = cols[artistIdx]?.trim();

    if (!name || !artist) continue;

    tracks.push({
      name,
      artist: artist.split(';')[0].trim(), // Take first artist for better search
      album: albumIdx !== -1 ? (cols[albumIdx]?.trim() ?? '') : '',
      durationMs: durationIdx !== -1 ? parseInt(cols[durationIdx] ?? '0', 10) : 0,
    });
  }

  return tracks;
}

/** Parse a single CSV line handling quoted fields with commas */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}
