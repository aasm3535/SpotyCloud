<script lang="ts">
  import { parseSpotifyCSV, type SpotifyTrackEntry } from '$lib/utils/csvParser';
  import { batchMatch, type MatchResult } from '$lib/utils/spotifyMatcher';
  import { likeTracksBatch } from '$lib/stores/liked.svelte';
  import { createPlaylist, addTracksToPlaylistBatch } from '$lib/stores/playlists.svelte';
  import { play } from '$lib/stores/player.svelte';
  import { getArtworkUrl } from '$lib/utils/image';
  import { Upload, CheckCircle, XCircle, Search, Heart, ListMusic, Play, ExternalLink, Loader2, Music, ArrowRight, ArrowLeft } from 'lucide-svelte';

  type Step = 'intro' | 'upload' | 'matching' | 'results';

  let step = $state<Step>('intro');
  let entries = $state<SpotifyTrackEntry[]>([]);
  let results = $state<MatchResult[]>([]);
  let progress = $state({ done: 0, total: 0 });
  let isDragging = $state(false);
  let fileName = $state('');
  let error = $state('');

  // Results stats
  const found = $derived(results.filter(r => r.status === 'found'));
  const notFound = $derived(results.filter(r => r.status === 'not_found'));

  // Import state
  let importMode = $state<'liked' | 'playlist'>('liked');
  let isImporting = $state(false);
  let importDone = $state(false);
  let importedCount = $state(0);

  function openUrl(url: string) {
    try {
      // @ts-ignore
      window.__TAURI__?.opener?.openUrl?.(url) ?? window.open(url, '_blank');
    } catch { window.open(url, '_blank'); }
  }

  function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      error = 'Select a .csv file';
      return;
    }
    error = '';
    fileName = file.name;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        entries = parseSpotifyCSV(text);
        if (entries.length === 0) {
          error = 'No tracks found. Check that your CSV has "Track Name" and "Artist Name(s)" columns.';
          return;
        }
        step = 'upload';
      } catch (err) {
        error = err instanceof Error ? err.message : 'Failed to parse CSV';
      }
    };
    reader.readAsText(file);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    const file = e.dataTransfer?.files[0];
    if (file) handleFile(file);
  }

  function handleDragOver(e: DragEvent) { e.preventDefault(); isDragging = true; }
  function handleDragLeave() { isDragging = false; }

  function handleFileInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) handleFile(file);
  }

  async function startMatching() {
    step = 'matching';
    results = [];
    progress = { done: 0, total: entries.length };
    await batchMatch(entries, (done, total, result) => {
      progress = { done, total };
      results = [...results, result];
    }, 2, 600);
    step = 'results';
  }

  async function importTracks() {
    if (found.length === 0) return;
    isImporting = true;
    importedCount = 0;

    const tracks = found
      .map(r => r.soundcloud)
      .filter((t): t is NonNullable<typeof t> => t !== null);

    if (importMode === 'liked') {
      likeTracksBatch(tracks);
    } else {
      const pl = createPlaylist('Spotify Import');
      addTracksToPlaylistBatch(pl.id, tracks);
    }

    importedCount = tracks.length;
    isImporting = false;
    importDone = true;
  }

  function removeResult(index: number) {
    results = results.filter((_, i) => i !== index);
  }

  function reset() {
    step = 'intro';
    entries = [];
    results = [];
    progress = { done: 0, total: 0 };
    fileName = '';
    error = '';
    importDone = false;
    importedCount = 0;
  }
</script>

<div class="import-page">

  <!-- ===== STEP: INTRO ===== -->
  {#if step === 'intro'}
    <div class="intro">
      <!-- Hero -->
      <div class="hero">
        <div class="hero-icon">
          <svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z" fill="currentColor" stroke="none"/>
          </svg>
        </div>
        <h1 class="hero-title">Import from Spotify</h1>
        <p class="hero-sub">Move your music to SpotyCloud in 3 steps</p>
      </div>

      <!-- Steps -->
      <div class="steps-card">
        <div class="step-row">
          <div class="step-num">1</div>
          <div class="step-body">
            <p class="step-title">Export your playlist</p>
            <p class="step-desc">
              Open
              <button onclick={() => openUrl('https://exportify.net')} class="link">
                exportify.net <ExternalLink class="w-3 h-3 inline" />
              </button>
              , log in with Spotify and click Export on any playlist
            </p>
          </div>
        </div>
        <div class="step-divider"></div>
        <div class="step-row">
          <div class="step-num">2</div>
          <div class="step-body">
            <p class="step-title">Drop the CSV here</p>
            <p class="step-desc">Drag the downloaded file into the area below</p>
          </div>
        </div>
        <div class="step-divider"></div>
        <div class="step-row">
          <div class="step-num">3</div>
          <div class="step-body">
            <p class="step-title">We'll find them on SoundCloud</p>
            <p class="step-desc">Matching by title & artist, then add to your library</p>
          </div>
        </div>
      </div>

      <p class="alt-text">
        Also works with:
        <button onclick={() => openUrl('https://www.chosic.com/spotify-playlist-exporter/')} class="link-muted">Chosic</button>,
        <button onclick={() => openUrl('https://www.tunemymusic.com/transfer/spotify-to-file')} class="link-muted">TuneMyMusic</button>,
        <button onclick={() => openUrl('https://playlist-backup.com')} class="link-muted">playlist-backup.com</button>
      </p>

      <!-- Drop zone -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="drop-zone"
        class:dragging={isDragging}
        ondrop={handleDrop}
        ondragover={handleDragOver}
        ondragleave={handleDragLeave}
      >
        <input type="file" accept=".csv" class="hidden" id="csv-input" onchange={handleFileInput} />
        <label for="csv-input" class="drop-label">
          <div class="drop-icon" class:active={isDragging}>
            <Upload class="w-6 h-6" />
          </div>
          <span class="drop-text">{isDragging ? 'Drop it!' : 'Drag CSV here or click to browse'}</span>
        </label>
      </div>

      {#if error}
        <div class="error-bar">
          <XCircle class="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      {/if}
    </div>

  <!-- ===== STEP: UPLOAD PREVIEW ===== -->
  {:else if step === 'upload'}
    <div class="section-wrap">
      <div class="section-header">
        <button onclick={reset} class="back-btn"><ArrowLeft class="w-4 h-4" /></button>
        <div>
          <h2 class="section-title">{fileName}</h2>
          <p class="section-sub">{entries.length} tracks ready to match</p>
        </div>
      </div>

      <div class="preview-list">
        <div class="preview-head">
          <span>#</span>
          <span>Title</span>
          <span>Artist</span>
        </div>
        {#each entries.slice(0, 50) as entry, i}
          <div class="preview-row">
            <span class="num">{i + 1}</span>
            <span class="title">{entry.name}</span>
            <span class="artist">{entry.artist}</span>
          </div>
        {/each}
        {#if entries.length > 50}
          <p class="more-hint">...and {entries.length - 50} more</p>
        {/if}
      </div>

      <button onclick={startMatching} class="action-btn primary">
        <Search class="w-5 h-5" />
        Search on SoundCloud
      </button>
    </div>

  <!-- ===== STEP: MATCHING ===== -->
  {:else if step === 'matching'}
    <div class="section-wrap">
      <div class="section-header">
        <Loader2 class="w-5 h-5 text-[#1db954] animate-spin shrink-0" />
        <div>
          <h2 class="section-title">Searching SoundCloud...</h2>
          <p class="section-sub">{progress.done} / {progress.total}</p>
        </div>
      </div>

      <div class="progress-track">
        <div class="progress-fill" style="width: {progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%"></div>
      </div>

      <div class="live-feed">
        {#each results.slice(-6).reverse() as r}
          <div class="live-row" class:ok={r.status === 'found'}>
            {#if r.status === 'found'}
              <CheckCircle class="w-3.5 h-3.5 text-[#1db954] shrink-0" />
            {:else}
              <XCircle class="w-3.5 h-3.5 text-[#e91429] shrink-0" />
            {/if}
            <span class="truncate">{r.spotify.artist} — {r.spotify.name}</span>
            {#if r.status === 'found'}
              <span class="live-pct">{Math.round(r.confidence * 100)}%</span>
            {/if}
          </div>
        {/each}
      </div>
    </div>

  <!-- ===== STEP: RESULTS ===== -->
  {:else if step === 'results'}
    <div class="section-wrap">

      {#if importDone}
        <div class="done-screen">
          <CheckCircle class="w-14 h-14 text-[#1db954]" />
          <h2 class="done-title">Done!</h2>
          <p class="done-sub">{importedCount} tracks added to {importMode === 'liked' ? 'Liked Songs' : 'new playlist'}</p>
          <div class="done-actions">
            <a href={importMode === 'liked' ? '/liked' : '/'} class="action-btn primary small">
              {importMode === 'liked' ? 'Go to Liked Songs' : 'Go Home'}
            </a>
            <button onclick={reset} class="action-btn ghost small">Import More</button>
          </div>
        </div>

      {:else}
        <div class="section-header">
          <button onclick={reset} class="back-btn"><ArrowLeft class="w-4 h-4" /></button>
          <h2 class="section-title">Results</h2>
        </div>

        <!-- Stats -->
        <div class="stats">
          <div class="stat">
            <CheckCircle class="w-4 h-4 text-[#1db954]" />
            <span class="stat-num">{found.length}</span>
            <span class="stat-label">found</span>
          </div>
          <div class="stat-sep"></div>
          <div class="stat">
            <XCircle class="w-4 h-4 text-[#e91429]" />
            <span class="stat-num">{notFound.length}</span>
            <span class="stat-label">not found</span>
          </div>
          <div class="stat-sep"></div>
          <div class="stat">
            <Music class="w-4 h-4 text-[#b3b3b3]" />
            <span class="stat-num">{results.length}</span>
            <span class="stat-label">total</span>
          </div>
        </div>

        <!-- Import controls -->
        <div class="import-bar">
          <div class="import-modes">
            <button class="mode-pill" class:active={importMode === 'liked'} onclick={() => importMode = 'liked'}>
              <Heart class="w-3.5 h-3.5" /> Liked Songs
            </button>
            <button class="mode-pill" class:active={importMode === 'playlist'} onclick={() => importMode = 'playlist'}>
              <ListMusic class="w-3.5 h-3.5" /> New Playlist
            </button>
          </div>
          <button onclick={importTracks} disabled={isImporting || found.length === 0} class="action-btn primary small">
            {#if isImporting}
              <Loader2 class="w-4 h-4 animate-spin" /> Importing...
            {:else}
              Import {found.length} tracks
            {/if}
          </button>
        </div>

        <!-- Found list -->
        {#if found.length > 0}
          <div class="list-section">
            <div class="list-head">
              <span class="list-label">Found ({found.length})</span>
              <span class="match-hint" title="How closely the SoundCloud track matches the Spotify original by title, artist and duration">Match %</span>
            </div>
            <div class="track-list">
              {#each found as r, i}
                {#if r.soundcloud}
                  <div class="track-row">
                    <div class="track-art">
                      {#if r.soundcloud.artwork_url}
                        <img src={getArtworkUrl(r.soundcloud.artwork_url, 'small')} alt="" />
                      {:else}
                        <Music class="w-4 h-4 text-[#535353]" />
                      {/if}
                    </div>
                    <div class="track-meta">
                      <p class="track-name">{r.soundcloud.title}</p>
                      <p class="track-artist">{r.soundcloud.user.username}</p>
                    </div>
                    <span class="badge" class:high={r.confidence >= 0.7} class:mid={r.confidence >= 0.5 && r.confidence < 0.7} class:low={r.confidence < 0.5}>
                      {Math.round(r.confidence * 100)}%
                    </span>
                    <button onclick={() => r.soundcloud && play(r.soundcloud)} class="row-btn" title="Preview">
                      <Play class="w-3.5 h-3.5" />
                    </button>
                    <button onclick={() => removeResult(results.indexOf(r))} class="row-btn del" title="Exclude">
                      <XCircle class="w-3.5 h-3.5" />
                    </button>
                  </div>
                {/if}
              {/each}
            </div>
          </div>
        {/if}

        <!-- Not found -->
        {#if notFound.length > 0}
          <div class="list-section">
            <div class="list-head">
              <span class="list-label">Not Found ({notFound.length})</span>
            </div>
            <div class="track-list short">
              {#each notFound as r}
                <div class="track-row dim">
                  <div class="track-art empty">
                    <Music class="w-4 h-4 text-[#3a3a3a]" />
                  </div>
                  <div class="track-meta">
                    <p class="track-name muted">{r.spotify.name}</p>
                    <p class="track-artist">{r.spotify.artist}</p>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  /* ---- Layout ---- */
  .import-page {
    max-width: 100%;
  }

  .section-wrap {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* ---- Intro ---- */
  .intro {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .hero {
    text-align: center;
    padding: 8px 0 4px;
  }
  .hero-icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: linear-gradient(135deg, #1db954, #1ed760);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #000;
    margin: 0 auto 14px;
  }
  .hero-title {
    font-size: 24px;
    font-weight: 800;
    color: #fff;
    line-height: 1.2;
  }
  .hero-sub {
    font-size: 14px;
    color: #b3b3b3;
    margin-top: 6px;
  }

  /* Steps card */
  .steps-card {
    background: #181818;
    border-radius: 12px;
    padding: 20px;
  }
  .step-row {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }
  .step-num {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: #282828;
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .step-body {
    flex: 1;
    min-width: 0;
  }
  .step-title {
    font-size: 14px;
    font-weight: 600;
    color: #fff;
  }
  .step-desc {
    font-size: 13px;
    color: #b3b3b3;
    margin-top: 2px;
    line-height: 1.4;
  }
  .step-divider {
    width: 1px;
    height: 12px;
    background: #282828;
    margin: 6px 0 6px 12px;
  }

  .link {
    color: #1db954;
    font-weight: 500;
  }
  .link:hover { text-decoration: underline; }

  .alt-text {
    font-size: 12px;
    color: #535353;
    text-align: center;
  }
  .link-muted {
    color: #7f7f7f;
  }
  .link-muted:hover {
    color: #b3b3b3;
    text-decoration: underline;
  }

  /* Drop zone */
  .drop-zone {
    border: 2px dashed #2a2a2a;
    border-radius: 12px;
    transition: all 0.2s;
  }
  .drop-zone:hover {
    border-color: #3a3a3a;
    background: rgba(255,255,255, 0.02);
  }
  .drop-zone.dragging {
    border-color: #1db954;
    background: rgba(29,185,84, 0.04);
  }
  .drop-label {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 28px 16px;
    cursor: pointer;
  }
  .drop-icon {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: #1e1e1e;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #7f7f7f;
    transition: all 0.2s;
    flex-shrink: 0;
  }
  .drop-icon.active {
    background: rgba(29,185,84, 0.12);
    color: #1db954;
  }
  .drop-text {
    font-size: 14px;
    color: #b3b3b3;
  }

  .error-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: rgba(233,20,41, 0.08);
    border: 1px solid rgba(233,20,41, 0.15);
    border-radius: 8px;
    color: #e91429;
    font-size: 13px;
  }

  /* ---- Section header ---- */
  .section-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .section-title {
    font-size: 18px;
    font-weight: 700;
    color: #fff;
  }
  .section-sub {
    font-size: 13px;
    color: #b3b3b3;
  }

  .back-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    color: #b3b3b3;
    background: rgba(255,255,255, 0.07);
    flex-shrink: 0;
  }
  .back-btn:hover { color: #fff; background: rgba(255,255,255, 0.12); }

  /* ---- Preview ---- */
  .preview-list {
    max-height: min(50vh, 360px);
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.08) transparent;
    border-radius: 8px;
    background: #181818;
  }
  .preview-head {
    display: grid;
    grid-template-columns: 36px 1fr 1fr;
    gap: 8px;
    padding: 8px 12px;
    font-size: 11px;
    color: #7f7f7f;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid #222;
    position: sticky;
    top: 0;
    background: #181818;
    z-index: 1;
  }
  .preview-row {
    display: grid;
    grid-template-columns: 36px 1fr 1fr;
    gap: 8px;
    padding: 6px 12px;
    font-size: 13px;
  }
  .preview-row:hover { background: rgba(255,255,255, 0.03); }
  .preview-row .num { color: #535353; text-align: right; }
  .preview-row .title { color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .preview-row .artist { color: #b3b3b3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .more-hint { text-align: center; padding: 8px; font-size: 12px; color: #535353; }

  /* ---- Action buttons ---- */
  .action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-weight: 700;
    border-radius: 9999px;
    transition: all 0.15s;
    cursor: pointer;
  }
  .action-btn.primary {
    background: #1db954;
    color: #000;
    padding: 12px 24px;
    font-size: 14px;
    width: 100%;
  }
  .action-btn.primary:hover { background: #1ed760; transform: scale(1.02); }
  .action-btn.primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .action-btn.primary.small { padding: 10px 20px; font-size: 13px; width: auto; }
  .action-btn.ghost {
    background: rgba(255,255,255, 0.08);
    color: #fff;
    padding: 10px 20px;
    font-size: 13px;
  }
  .action-btn.ghost:hover { background: rgba(255,255,255, 0.12); }

  /* ---- Progress ---- */
  .progress-track {
    width: 100%;
    height: 4px;
    background: #1e1e1e;
    border-radius: 2px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: #1db954;
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .live-feed {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .live-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 13px;
    color: #7f7f7f;
    background: rgba(255,255,255, 0.02);
  }
  .live-row.ok { color: #e0e0e0; }
  .live-pct { margin-left: auto; font-size: 11px; color: #535353; flex-shrink: 0; }

  /* ---- Done screen ---- */
  .done-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 48px 20px;
  }
  .done-title {
    font-size: 22px;
    font-weight: 800;
    color: #fff;
    margin-top: 12px;
  }
  .done-sub {
    font-size: 14px;
    color: #b3b3b3;
    margin-top: 6px;
  }
  .done-actions {
    display: flex;
    gap: 10px;
    margin-top: 20px;
    flex-wrap: wrap;
    justify-content: center;
  }

  /* ---- Stats ---- */
  .stats {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 16px;
    background: #181818;
    border-radius: 10px;
    flex-wrap: wrap;
  }
  .stat {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .stat-num {
    font-size: 18px;
    font-weight: 800;
    color: #fff;
  }
  .stat-label {
    font-size: 12px;
    color: #7f7f7f;
  }
  .stat-sep {
    width: 1px;
    height: 20px;
    background: #282828;
  }

  /* ---- Import bar ---- */
  .import-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px;
    background: #181818;
    border-radius: 10px;
    flex-wrap: wrap;
  }
  .import-modes {
    display: flex;
    gap: 8px;
  }
  .mode-pill {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 14px;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 600;
    color: #7f7f7f;
    background: #222;
    border: 1px solid transparent;
    transition: all 0.15s;
  }
  .mode-pill:hover { color: #b3b3b3; background: #2a2a2a; }
  .mode-pill.active {
    color: #fff;
    background: rgba(29,185,84, 0.12);
    border-color: rgba(29,185,84, 0.4);
  }

  /* ---- Track lists ---- */
  .list-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .list-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 4px;
  }
  .list-label {
    font-size: 12px;
    font-weight: 700;
    color: #7f7f7f;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .match-hint {
    font-size: 11px;
    color: #535353;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    cursor: help;
    border-bottom: 1px dotted #3a3a3a;
    padding-right: 60px;
  }

  .track-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    max-height: min(50vh, 400px);
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.08) transparent;
  }
  .track-list.short { max-height: 200px; }

  .track-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 8px;
    border-radius: 6px;
    min-height: 48px;
  }
  .track-row:hover { background: rgba(255,255,255, 0.05); }
  .track-row.dim { opacity: 0.5; }

  .track-art {
    width: 36px;
    height: 36px;
    border-radius: 4px;
    overflow: hidden;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #222;
  }
  .track-art img { width: 100%; height: 100%; object-fit: cover; }
  .track-art.empty { background: #1a1a1a; }

  .track-meta { flex: 1; min-width: 0; }
  .track-name {
    font-size: 13px;
    font-weight: 500;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .track-name.muted { color: #b3b3b3; }
  .track-artist {
    font-size: 11px;
    color: #7f7f7f;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .badge {
    font-size: 11px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 9999px;
    flex-shrink: 0;
  }
  .badge.high { background: rgba(29,185,84, 0.12); color: #1db954; }
  .badge.mid { background: rgba(255,165,0, 0.12); color: #ffa500; }
  .badge.low { background: rgba(233,20,41, 0.12); color: #e91429; }

  .row-btn {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    color: #535353;
    flex-shrink: 0;
    opacity: 0;
    transition: all 0.15s;
  }
  .track-row:hover .row-btn { opacity: 1; }
  .row-btn:hover { color: #fff; background: rgba(255,255,255, 0.08); }
  .row-btn.del:hover { color: #e91429; background: rgba(233,20,41, 0.08); }

  /* Responsive */
  @media (max-width: 500px) {
    .hero-title { font-size: 20px; }
    .steps-card { padding: 16px; }
    .drop-label { flex-direction: column; padding: 24px 16px; }
    .preview-head, .preview-row { grid-template-columns: 28px 1fr; }
    .preview-head span:last-child, .preview-row .artist { display: none; }
    .stats { gap: 10px; }
    .stat-sep { display: none; }
    .import-bar { flex-direction: column; align-items: stretch; }
    .match-hint { padding-right: 52px; }
  }
</style>
