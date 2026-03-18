<script lang="ts">
  import type { SCTrack } from '$lib/api/types';
  import { getPlayer, seek } from '$lib/stores/player.svelte';
  import { fetchLyrics, getCurrentLine, voteLyrics, getLyricsScores, generateTrackHash, type LyricsData, type LyricsSearchResult, type LyricsScore } from '$lib/api/lyrics';
  import { getArtworkUrl } from '$lib/utils/image';
  import { setHeaderColor } from '$lib/stores/headerColor.svelte';
  import { getSettings } from '$lib/stores/settings.svelte';
  import { ThumbsUp, ThumbsDown, ChevronLeft, ChevronRight, Search } from 'lucide-svelte';

  const player = getPlayer();
  const settings = getSettings();

  let searchResult = $state<LyricsSearchResult | null>(null);
  let currentVariantIndex = $state(0);
  let isLoading = $state(true);
  let currentLineIndex = $state(-1);
  let container = $state<HTMLDivElement | null>(null);
  let lastTrackId = $state('');
  let myVote = $state<1 | -1 | 0>(0);
  let myVotesMap = $state<Map<string, 1 | -1>>(new Map());
  let scoreMap = $state<Map<string, LyricsScore>>(new Map());
  let trackHash = $state('');
  let showSearch = $state(false);
  let customQuery = $state('');
  let lastTitle = $state('');
  let lastArtist = $state('');

  const lyrics = $derived(searchResult?.all[currentVariantIndex] ?? null);
  const totalVariants = $derived(searchResult?.all.length ?? 0);

  $effect(() => {
    setHeaderColor(null);
  });

  $effect(() => {
    const track = player.currentTrack;
    if (track) {
      const trackId = `${track.id}`;
      if (trackId !== lastTrackId) {
        lastTrackId = trackId;
        const { title, artists, primaryArtist } = extractLyricsSearchData(track);
        loadLyrics(trackId, title, primaryArtist, track.duration, artists);
      }
    }
  });

  $effect(() => {
    const timeMs = player.currentTime * 1000;
    if (lyrics?.lines) {
      currentLineIndex = getCurrentLine(lyrics.lines, timeMs);
    }
  });

  $effect(() => {
    const idx = currentLineIndex;
    const cont = container;
    if (idx >= 0 && cont && lyrics?.lines) {
      requestAnimationFrame(() => {
        const activeLine = cont.querySelector('.line.active') as HTMLElement;
        if (activeLine) {
          activeLine.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        }
      });
    }
  });

  function extractTitleArtistPair(rawTitle: string): { artist: string; title: string } | null {
    const cleaned = rawTitle.trim();
    const separators = [' - ', ' — ', ' – '];

    for (const separator of separators) {
      const parts = cleaned.split(separator).map(part => part.trim()).filter(Boolean);
      if (parts.length === 2 && parts[0].length > 1 && parts[1].length > 1) {
        return { artist: parts[0], title: parts[1] };
      }
    }

    return null;
  }

  function dedupeArtists(artists: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const artist of artists) {
      const trimmed = artist.trim();
      if (!trimmed) continue;

      const normalized = trimmed.toLowerCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      result.push(trimmed);
    }

    return result;
  }

  function extractLyricsSearchData(track: SCTrack): { title: string; primaryArtist: string; artists: string[] } {
    const titlePair = extractTitleArtistPair(track.title);
    const title = titlePair?.title ?? track.title;
    const artists = dedupeArtists([
      titlePair?.artist ?? '',
      track.publisher_metadata?.artist ?? '',
      track.user.full_name ?? '',
      track.user.username ?? ''
    ]);

    return {
      title,
      primaryArtist: artists[0] ?? track.user.username,
      artists
    };
  }

  async function loadLyrics(scTrackId: string, title: string, artist: string, duration?: number, artistCandidates: string[] = []) {
    isLoading = true;
    searchResult = null;
    currentVariantIndex = 0;
    currentLineIndex = -1;
    myVote = 0;
    myVotesMap = new Map();
    scoreMap = new Map();
    trackHash = scTrackId ? `sc_${scTrackId}` : generateTrackHash(title, artist);
    lastTitle = title;
    lastArtist = artist;

    try {
      const data = await fetchLyrics(title, artist, duration, artistCandidates);
      searchResult = data;
      if (data && data.all.length > 0) {
        currentVariantIndex = data.bestIndex;

        // Load community scores and this user's previous vote for the current track.
        try {
          const { scores, my_votes } = await getLyricsScores(trackHash);
          const nextScoreMap = new Map<string, LyricsScore>();
          for (const score of scores) {
            nextScoreMap.set(score.lyrics_id, score);
          }
          scoreMap = nextScoreMap;

          const votesMap = new Map<string, 1 | -1>();
          for (const v of my_votes) {
            votesMap.set(v.lyrics_id, v.vote as 1 | -1);
          }
          myVotesMap = votesMap;

          const communityIdx = getCommunityPreferredVariantIndex(data.all, nextScoreMap);
          if (communityIdx >= 0) {
            currentVariantIndex = communityIdx;
          }

          // Keep personal positive choice as the strongest override for this user.
          const upvotedIdx = data.all.findIndex(v => votesMap.get(v.id) === 1);
          if (upvotedIdx >= 0) {
            currentVariantIndex = upvotedIdx;
          }

          // Restore vote state for selected variant
          const currentLyrics = data.all[currentVariantIndex];
          if (currentLyrics && votesMap.has(currentLyrics.id)) {
            myVote = votesMap.get(currentLyrics.id)!;
          }
        } catch {}
      }
    } catch (e) {
      console.error('Failed to load lyrics:', e);
    } finally {
      isLoading = false;
    }
  }

  function getCommunityPreferredVariantIndex(variants: LyricsData[], scores: Map<string, LyricsScore>): number {
    const ranked = variants
      .map((variant, index) => {
        const score = scores.get(variant.id);
        return {
          index,
          score: Number(score?.score ?? 0),
          totalVotes: Number(score?.total_votes ?? 0),
        };
      })
      .filter(entry => entry.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.totalVotes !== a.totalVotes) return b.totalVotes - a.totalVotes;
        return a.index - b.index;
      });

    return ranked[0]?.index ?? -1;
  }

  function handleLineClick(index: number) {
    if (lyrics?.lines[index]) {
      seek(lyrics.lines[index].time / 1000);
    }
  }

  function switchVariant(delta: number) {
    if (!searchResult) return;
    currentVariantIndex = (currentVariantIndex + delta + totalVariants) % totalVariants;
    currentLineIndex = -1;
    const currentLyrics = searchResult.all[currentVariantIndex];
    myVote = currentLyrics && myVotesMap.has(currentLyrics.id) ? myVotesMap.get(currentLyrics.id)! : 0;
  }

  async function handleCustomSearch() {
    const q = customQuery.trim();
    if (!q) return;
    showSearch = false;
    // Split by " - " or just use as title
    const parts = q.split(/\s*-\s*/);
    if (parts.length >= 2) {
      await loadLyrics(lastTrackId, parts[1], parts[0], player.duration);
    } else {
      await loadLyrics(lastTrackId, q, lastArtist, player.duration);
    }
  }

  function handleSearchKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleCustomSearch();
    if (e.key === 'Escape') showSearch = false;
  }

  async function handleVote(vote: 1 | -1) {
    if (!lyrics || !trackHash) return;
    const newVote = myVote === vote ? 0 : vote;
    myVote = newVote;

    const nextVotesMap = new Map<string, 1 | -1>();
    if (newVote !== 0) {
      nextVotesMap.set(lyrics.id, newVote);
    }
    myVotesMap = nextVotesMap;

    await voteLyrics(trackHash, lyrics.id, newVote);

    try {
      const { scores } = await getLyricsScores(trackHash);
      const nextScoreMap = new Map<string, LyricsScore>();
      for (const score of scores) {
        nextScoreMap.set(score.lyrics_id, score);
      }
      scoreMap = nextScoreMap;
    } catch {}
  }
</script>

<div class="lyrics-page">
  {#if player.currentTrack?.artwork_url}
    <div class="bg-blur" style="background-image: url({getArtworkUrl(player.currentTrack.artwork_url, 'large')})"></div>
  {/if}

  <div class="lyrics-wrapper" bind:this={container}>
    {#if isLoading}
      <div class="center-content">
        <div class="dot-spinner">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    {:else if lyrics?.lines.length}
      {#if currentLineIndex === -1 && player.currentTime > 0}
          <div class="intro-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        {/if}

        {#each lyrics.lines as line, i}
          <button
            class="line"
            class:active={i === currentLineIndex}
            class:played={i < currentLineIndex}
            class:glow={settings.lyricsGlow}
            class:left-align={settings.lyricsTextAlign === 'left'}
            style="font-size: {settings.lyricsFontSize}px"
            onclick={() => handleLineClick(i)}
          >
            {line.text}
          </button>
        {/each}
    {:else}
      <div class="center-content">
        <p class="text-xl font-bold">No lyrics available</p>
        <p class="mt-2 text-[#666]">We couldn't find lyrics for this track</p>
      </div>
    {/if}
  </div>

  <!-- Bottom controls — fixed over everything -->
  {#if !isLoading && totalVariants > 0}
    <div class="lyrics-controls">
      {#if showSearch}
        <div class="search-bar">
          <Search class="w-3.5 h-3.5 text-[rgba(255,255,255,0.3)] shrink-0" />
          <input
            type="text"
            bind:value={customQuery}
            onkeydown={handleSearchKeydown}
            placeholder="artist - title"
            class="search-input"
          />
          <button class="search-go" onclick={handleCustomSearch}>Go</button>
        </div>
      {:else}
        <div class="controls-row">
          {#if totalVariants > 1}
            <button class="ctrl" onclick={() => switchVariant(-1)}>
              <ChevronLeft class="w-4 h-4" />
            </button>
          {/if}

          <span class="variant-info">
            {#if totalVariants > 1}
              <span class="variant-count">{currentVariantIndex + 1}/{totalVariants}</span>
            {/if}
          </span>

          {#if totalVariants > 1}
            <button class="ctrl" onclick={() => switchVariant(1)}>
              <ChevronRight class="w-4 h-4" />
            </button>
          {/if}

          <div class="divider"></div>

          <button
            class="vote-btn {myVote === 1 ? 'voted-up' : ''}"
            onclick={() => handleVote(1)}
          >
            <ThumbsUp class="w-3.5 h-3.5 {myVote === 1 ? 'fill-current' : ''}" />
          </button>
          <button
            class="vote-btn {myVote === -1 ? 'voted-down' : ''}"
            onclick={() => handleVote(-1)}
          >
            <ThumbsDown class="w-3.5 h-3.5 {myVote === -1 ? 'fill-current' : ''}" />
          </button>

          <div class="divider"></div>

          <button class="ctrl" onclick={() => { showSearch = true; customQuery = `${lastArtist} - ${lastTitle}`; }}>
            <Search class="w-3.5 h-3.5" />
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* Hide parent main scrollbar on lyrics page */
  :global(main:has(.lyrics-page)) {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
  }
  :global(main:has(.lyrics-page))::-webkit-scrollbar {
    display: none !important;
    width: 0 !important;
  }

  .lyrics-page {
    position: relative;
    min-height: calc(100vh - 160px);
    margin: -24px;
    padding: 24px;
    padding-bottom: 90px;
    overflow: hidden;
  }

  .lyrics-controls {
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 50;
  }

  .controls-row {
    display: flex;
    align-items: center;
    gap: 0;
    background: #000;
    border-radius: 18px 18px 0 0;
    padding: 8px 8px 10px;
  }

  .divider {
    width: 1px;
    height: 14px;
    background: rgba(255, 255, 255, 0.08);
    margin: 0 4px;
  }

  .variant-info {
    display: flex;
    align-items: center;
    min-width: 0;
    padding: 0 2px;
  }

  .variant-count {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.3);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .ctrl, .vote-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    color: rgba(255, 255, 255, 0.4);
    background: transparent;
    transition: color 0.15s;
  }
  .ctrl:hover, .vote-btn:hover {
    color: rgba(255, 255, 255, 0.8);
  }
  .ctrl:active, .vote-btn:active {
    transform: scale(0.9);
  }
  .vote-btn.voted-up {
    color: #1db954;
  }
  .vote-btn.voted-down {
    color: #e85d5d;
  }

  .search-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #000;
    border-radius: 18px 18px 0 0;
    padding: 7px 8px 9px 14px;
    min-width: 280px;
  }

  .search-input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    color: #fff;
    font-size: 13px;
    min-width: 0;
  }
  .search-input::placeholder {
    color: rgba(255, 255, 255, 0.2);
  }

  .search-go {
    font-size: 11px;
    font-weight: 700;
    color: #000;
    background: #fff;
    border-radius: 50%;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.15s;
    flex-shrink: 0;
  }
  .search-go:hover {
    opacity: 0.85;
  }
  .search-go:active {
    transform: scale(0.92);
  }

  .intro-dots {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 60px;
  }

  .intro-dots span {
    width: 12px;
    height: 12px;
    background: rgba(255, 255, 255, 0.5);
    border-radius: 50%;
    animation: bounce 1.4s ease-in-out infinite both;
  }

  .intro-dots span:nth-child(1) {
    animation-delay: -0.32s;
  }

  .intro-dots span:nth-child(2) {
    animation-delay: -0.16s;
  }

  @keyframes bounce {
    0%, 80%, 100% {
      transform: scale(0.6);
      opacity: 0.4;
    }
    40% {
      transform: scale(1.2);
      opacity: 1;
      background: #fff;
      box-shadow: 0 0 20px rgba(255, 255, 255, 0.6);
    }
  }

  .bg-blur {
    position: absolute;
    top: -30%;
    left: -30%;
    width: 160%;
    height: 160%;
    z-index: 0;
    background-size: cover;
    background-position: center;
    filter: blur(100px) brightness(0.25) saturate(1.2);
    animation: vinylSpin 45s linear infinite;
    border-radius: 50%;
  }

  @keyframes vinylSpin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .lyrics-wrapper {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: calc(100vh - 250px);
    overflow-y: scroll;
    overflow-x: hidden;
    overflow: -moz-scrollbars-none;
    scroll-behavior: smooth;
    width: 100%;
    padding: 40vh 20px;
    gap: 20px;
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
  }

  .lyrics-wrapper::-webkit-scrollbar {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
  }

  .center-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: white;
  }

  .line {
    font-size: 28px;
    font-weight: 500;
    text-align: center;
    color: rgba(255, 255, 255, 0.5);
    transition: transform 0.4s ease-out, color 0.3s ease;
    padding: 10px 20px;
    border-radius: 8px;
    background: transparent;
    word-break: break-word;
    cursor: pointer;
    flex-shrink: 0;
    max-width: 700px;
  }

  .line:hover {
    color: rgba(255, 255, 255, 0.7);
  }

  .line.played {
    color: rgba(255, 255, 255, 0.7);
  }

  .line.active {
    color: #fff;
    font-weight: 500;
    transform: scale(1.15);
  }

  .line.active.glow {
    text-shadow: 0 0 40px rgba(255, 255, 255, 0.4);
  }

  .line.left-align {
    text-align: left;
    align-self: flex-start;
    padding-left: 60px;
    max-width: none;
    width: calc(100% - 80px);
    transform-origin: left center;
  }

  .line.left-align.active {
    transform: scale(1.15);
    margin-left: 20px;
  }

  .bg-blur {
    filter: blur(60px) brightness(0.25) saturate(1.1);
    animation-duration: 60s;
  }

  .dot-spinner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }

  .dot-spinner span {
    width: 14px;
    height: 14px;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 50%;
    animation: dotPulse 1.4s ease-in-out infinite both;
  }

  .dot-spinner span:nth-child(1) {
    animation-delay: -0.32s;
  }

  .dot-spinner span:nth-child(2) {
    animation-delay: -0.16s;
  }

  @keyframes dotPulse {
    0%, 80%, 100% {
      transform: scale(0.4);
      opacity: 0.3;
    }
    40% {
      transform: scale(1);
      opacity: 1;
      box-shadow: 0 0 16px rgba(255, 255, 255, 0.5);
    }
  }
</style>
