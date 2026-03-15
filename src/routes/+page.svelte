<script lang="ts">
  import { getAuth } from '$lib/stores/auth.svelte';
  import { getPlayer, play, startWave, togglePlay } from '$lib/stores/player.svelte';
  import { getLikedTracks } from '$lib/stores/liked.svelte';
  import { getRelatedTracks, getUserTracks } from '$lib/api/soundcloud';
  import { getArtworkUrl } from '$lib/utils/image';
  import { Play, Pause, Heart, Search, RefreshCw, Radio } from 'lucide-svelte';
  import TrackRow from '$lib/components/track/TrackRow.svelte';
  import type { SCTrack } from '$lib/api/types';

  const auth = getAuth();
  const player = getPlayer();
  const liked = getLikedTracks();

  let showAllQueue = $state(false);

  // Recommendation state
  let wave = $state<SCTrack[]>([]);
  let moreLikeThis = $state<SCTrack[]>([]);
  let fromArtists = $state<SCTrack[]>([]);
  let isLoadingWave = $state(false);
  let isLoadingMore = $state(false);
  let isLoadingArtists = $state(false);
  let waveSourceTrack = $state<SCTrack | null>(null);
  let moreLikeTrack = $state<SCTrack | null>(null);
  let artistName = $state('');

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  let hoveredCard = $state<'liked' | 'search' | 'wave' | null>(null);
  let leaveTimer: ReturnType<typeof setTimeout> | null = null;

  function setHovered(card: 'liked' | 'search' | 'wave') {
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
    hoveredCard = card;
  }

  function clearHovered() {
    if (leaveTimer) clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => { hoveredCard = null; }, 200);
  }

  const visibleQueue = $derived(
    showAllQueue ? player.queue : player.queue.slice(0, 8)
  );

  // Pick a random item from array
  function pickRandom<T>(arr: T[]): T | undefined {
    if (arr.length === 0) return undefined;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // Shuffle array (Fisher-Yates)
  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Deduplicate tracks by id, excluding liked
  function dedup(tracks: SCTrack[], excludeIds: Set<number>): SCTrack[] {
    const seen = new Set<number>();
    return tracks.filter(t => {
      if (seen.has(t.id) || excludeIds.has(t.id)) return false;
      seen.add(t.id);
      return t.streamable && t.access !== 'blocked';
    });
  }

  async function loadWave() {
    const tracks = liked.tracks;
    if (tracks.length === 0) return;
    isLoadingWave = true;
    try {
      // Pick 3 random liked tracks and get related for each
      const seeds = shuffle(tracks).slice(0, 3);
      waveSourceTrack = seeds[0];
      const likedIds = new Set(liked.ids);
      const results = await Promise.all(
        seeds.map(t => getRelatedTracks(t.id, 8).catch(() => []))
      );
      wave = dedup(results.flat(), likedIds).slice(0, 20);
    } catch (e) {
      console.error('Failed to load wave:', e);
    } finally {
      isLoadingWave = false;
    }
  }

  async function loadMoreLikeThis() {
    const tracks = liked.tracks;
    if (tracks.length === 0) return;
    isLoadingMore = true;
    try {
      const seed = pickRandom(tracks);
      if (!seed) return;
      moreLikeTrack = seed;
      const likedIds = new Set(liked.ids);
      const related = await getRelatedTracks(seed.id, 12);
      moreLikeThis = dedup(related, likedIds).slice(0, 10);
    } catch (e) {
      console.error('Failed to load more like this:', e);
    } finally {
      isLoadingMore = false;
    }
  }

  async function loadFromArtists() {
    const tracks = liked.tracks;
    if (tracks.length === 0) return;
    isLoadingArtists = true;
    try {
      // Pick a random artist from liked tracks
      const seed = pickRandom(tracks);
      if (!seed) return;
      artistName = seed.user.username;
      const likedIds = new Set(liked.ids);
      const artistTracks = await getUserTracks(seed.user.id, 15);
      fromArtists = dedup(artistTracks, likedIds).slice(0, 10);
    } catch (e) {
      console.error('Failed to load artist tracks:', e);
    } finally {
      isLoadingArtists = false;
    }
  }

  async function loadAll() {
    if (liked.count === 0) return;
    await Promise.all([loadWave(), loadMoreLikeThis(), loadFromArtists()]);
  }

  // Load on mount if authenticated and has liked tracks
  $effect(() => {
    if (auth.isAuthenticated && liked.count > 0 && wave.length === 0 && !isLoadingWave) {
      loadAll();
    }
  });

  let isStartingWave = $state(false);

  async function handleStartWave() {
    if (liked.count === 0 || isStartingWave) return;
    isStartingWave = true;
    try {
      // Pick 2 random liked tracks, get related for each, mix them with some liked
      const seeds = shuffle(liked.tracks).slice(0, 2);
      const results = await Promise.all(
        seeds.map(t => getRelatedTracks(t.id, 8).catch(() => []))
      );
      const likedIds = new Set(liked.ids);
      const related = dedup(results.flat(), likedIds);
      // Mix: start with a liked track, then alternate
      const likedSample = shuffle(liked.tracks).slice(0, 3);
      const mixed = shuffle([...likedSample, ...related]).slice(0, 15);
      if (mixed.length > 0) {
        startWave(mixed);
      }
    } catch (e) {
      console.error('Failed to start wave:', e);
    } finally {
      isStartingWave = false;
    }
  }

  function playTrackFromList(track: SCTrack, list: SCTrack[]) {
    play(track, list);
  }
</script>

<div class="home-page">
  <!-- Gradient layers -->
  <div class="home-gradient-wrap">
    <div class="home-gradient-layer default" class:visible={hoveredCard === null && !player.waveMode}></div>
    <div class="home-gradient-layer liked" class:visible={hoveredCard === 'liked'}></div>
    <div class="home-gradient-layer search" class:visible={hoveredCard === 'search'}></div>
    <div class="home-gradient-layer wave-gradient" class:visible={hoveredCard === 'wave' || (hoveredCard === null && player.waveMode)}></div>
  </div>

  {#if auth.isAuthenticated}
    <div class="mb-8 relative z-10">
      <h1 class="text-3xl font-bold text-white mb-6">{getGreeting()}</h1>

      <div class="grid grid-cols-2 lg:grid-cols-3 gap-2">
        <!-- Liked Songs -->
        <a
          href="/liked"
          class="quick-card group"
          onmouseenter={() => setHovered('liked')}
          onmouseleave={() => clearHovered()}
        >
          <div class="quick-card-icon bg-gradient-to-br from-[#450af5] to-[#c4efd9]">
            <Heart class="w-6 h-6 text-white fill-current" />
          </div>
          <span class="font-bold text-sm text-white truncate">Liked Songs</span>
          <div class="play-btn">
            <Play class="w-5 h-5 text-black fill-current ml-0.5" />
          </div>
        </a>

        <!-- Search -->
        <a
          href="/search"
          class="quick-card group"
          onmouseenter={() => setHovered('search')}
          onmouseleave={() => clearHovered()}
        >
          <div class="quick-card-icon bg-gradient-to-br from-[#e13300] to-[#e8115b]">
            <Search class="w-6 h-6 text-white" />
          </div>
          <span class="font-bold text-sm text-white truncate">Search</span>
          <div class="play-btn">
            <Play class="w-5 h-5 text-black fill-current ml-0.5" />
          </div>
        </a>
      </div>

    </div>

    <!-- Your Wave — based on liked tracks -->
    {#if wave.length > 0 || isLoadingWave}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="section relative z-10"
        onmouseenter={() => setHovered('wave')}
        onmouseleave={() => clearHovered()}
      >
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <button
              onclick={() => player.waveMode ? togglePlay() : handleStartWave()}
              disabled={isStartingWave}
              class="wave-play-btn"
              title={player.waveMode && player.isPlaying ? 'Pause Wave' : 'Start Wave'}
            >
              {#if isStartingWave}
                <div class="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              {:else if player.waveMode && player.isPlaying}
                <Pause class="w-5 h-5 text-black fill-current" />
              {:else}
                <Play class="w-5 h-5 text-black fill-current ml-0.5" />
              {/if}
            </button>
            <div>
              <h2 class="text-xl font-extrabold text-white">Your Wave</h2>
              <p class="text-sm text-[#b3b3b3] mt-0.5">Based on your liked songs</p>
            </div>
          </div>
          <button
            onclick={loadWave}
            disabled={isLoadingWave}
            class="refresh-btn"
            title="Refresh"
          >
            <RefreshCw class="w-4 h-4 {isLoadingWave ? 'animate-spin' : ''}" />
          </button>
        </div>

        {#if isLoadingWave && wave.length === 0}
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {#each Array(5) as _}
              <div class="card-skeleton"></div>
            {/each}
          </div>
        {:else}
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {#each wave.slice(0, 10) as track (track.id)}
              <button class="track-card group" onclick={() => playTrackFromList(track, wave)}>
                <div class="track-card-art">
                  {#if track.artwork_url}
                    <img src={getArtworkUrl(track.artwork_url, 'medium')} alt="" class="w-full h-full object-cover" />
                  {:else}
                    <div class="w-full h-full bg-[#282828] flex items-center justify-center">
                      <svg class="w-10 h-10 text-[#535353]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" /></svg>
                    </div>
                  {/if}
                  <div class="card-play-btn">
                    <Play class="w-5 h-5 text-black fill-current ml-0.5" />
                  </div>
                </div>
                <p class="text-sm font-medium text-white truncate mt-2">{track.title}</p>
                <p class="text-xs text-[#b3b3b3] truncate">{track.user.username}</p>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- More Like This -->
    {#if moreLikeThis.length > 0 || isLoadingMore}
      <div class="section relative z-10">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-xl font-extrabold text-white">
              {moreLikeTrack ? `More like "${moreLikeTrack.title}"` : 'More Like This'}
            </h2>
            <p class="text-sm text-[#b3b3b3] mt-0.5">Tracks similar to your favorites</p>
          </div>
          <button
            onclick={loadMoreLikeThis}
            disabled={isLoadingMore}
            class="refresh-btn"
            title="Refresh"
          >
            <RefreshCw class="w-4 h-4 {isLoadingMore ? 'animate-spin' : ''}" />
          </button>
        </div>

        {#if isLoadingMore && moreLikeThis.length === 0}
          <div class="space-y-1">
            {#each Array(5) as _}
              <div class="row-skeleton"></div>
            {/each}
          </div>
        {:else}
          <div>
            {#each moreLikeThis as track, i (track.id)}
              <TrackRow {track} index={i} trackList={moreLikeThis} />
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- From Artists You Like -->
    {#if fromArtists.length > 0 || isLoadingArtists}
      <div class="section relative z-10">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-xl font-extrabold text-white">
              {artistName ? `More from ${artistName}` : 'From Artists You Like'}
            </h2>
            <p class="text-sm text-[#b3b3b3] mt-0.5">New tracks from your favorite artists</p>
          </div>
          <button
            onclick={loadFromArtists}
            disabled={isLoadingArtists}
            class="refresh-btn"
            title="Refresh"
          >
            <RefreshCw class="w-4 h-4 {isLoadingArtists ? 'animate-spin' : ''}" />
          </button>
        </div>

        {#if isLoadingArtists && fromArtists.length === 0}
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {#each Array(5) as _}
              <div class="card-skeleton"></div>
            {/each}
          </div>
        {:else}
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {#each fromArtists.slice(0, 10) as track (track.id)}
              <button class="track-card group" onclick={() => playTrackFromList(track, fromArtists)}>
                <div class="track-card-art">
                  {#if track.artwork_url}
                    <img src={getArtworkUrl(track.artwork_url, 'medium')} alt="" class="w-full h-full object-cover" />
                  {:else}
                    <div class="w-full h-full bg-[#282828] flex items-center justify-center">
                      <svg class="w-10 h-10 text-[#535353]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" /></svg>
                    </div>
                  {/if}
                  <div class="card-play-btn">
                    <Play class="w-5 h-5 text-black fill-current ml-0.5" />
                  </div>
                </div>
                <p class="text-sm font-medium text-white truncate mt-2">{track.title}</p>
                <p class="text-xs text-[#b3b3b3] truncate">{track.user.username}</p>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Queue Section -->
    {#if player.queue.length > 0}
      <div class="section relative z-10">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-extrabold text-white hover:underline cursor-pointer">Queue</h2>
          <button
            onclick={() => showAllQueue = !showAllQueue}
            class="text-sm font-bold text-[#b3b3b3] hover:text-white cursor-pointer"
          >
            {showAllQueue ? 'Show less' : 'Show all'}
          </button>
        </div>

        <p class="text-sm text-[#b3b3b3] mb-3">{player.queue.length} tracks in your queue</p>

        <div>
          {#each visibleQueue as track, i (track.id)}
            <TrackRow {track} index={i} trackList={player.queue} />
          {/each}
        </div>
      </div>
    {/if}

    <!-- Empty state if no liked tracks -->
    {#if liked.count === 0 && wave.length === 0}
      <div class="relative z-10 text-center py-12">
        <Heart class="w-12 h-12 text-[#535353] mx-auto mb-4" />
        <h2 class="text-xl font-bold text-white mb-2">Like some tracks first</h2>
        <p class="text-[#b3b3b3] text-sm mb-6">Search for music and hit the heart to build your wave</p>
        <a href="/search" class="inline-flex px-6 py-3 bg-[#1db954] hover:bg-[#1ed760] text-black font-bold rounded-full text-sm">
          Search tracks
        </a>
      </div>
    {/if}

  {:else}
    <div class="flex flex-col items-center justify-center py-20 relative z-10">
      <div class="w-32 h-32 rounded-full bg-gradient-to-br from-[#1db954] to-[#1ed760] flex items-center justify-center mb-8">
        <svg class="w-16 h-16 text-black" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z"/>
        </svg>
      </div>

      <h1 class="text-4xl font-black text-white mb-3">Welcome to SpotyCloud</h1>
      <p class="text-[#b3b3b3] text-base mb-8 text-center max-w-md">
        Your SoundCloud desktop player. Connect your account to start listening.
      </p>

      <a
        href="/settings"
        class="px-8 py-3 bg-[#1db954] hover:bg-[#1ed760] hover:scale-[1.04] text-black font-bold rounded-full text-sm"
      >
        Connect to SoundCloud
      </a>
    </div>
  {/if}
</div>

<style>
  .home-page {
    position: relative;
    margin: -24px;
    padding: 24px;
    min-height: 100%;
  }
  .home-gradient-wrap {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 300px;
    z-index: 0;
    pointer-events: none;
  }
  .home-gradient-layer {
    position: absolute;
    inset: 0;
    opacity: 0;
    transition: opacity 1s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .home-gradient-layer.visible {
    opacity: 1;
  }
  .home-gradient-layer.default {
    background: linear-gradient(180deg, #2b1d52 0%, #1f1632 50%, transparent 100%);
  }
  .home-gradient-layer.liked {
    background: linear-gradient(180deg, #450af5 0%, #2b1d52 50%, transparent 100%);
  }
  .home-gradient-layer.search {
    background: linear-gradient(180deg, #e13300 0%, #5a1a00 50%, transparent 100%);
  }
  .home-gradient-layer.wave-gradient {
    background:
      radial-gradient(ellipse 80% 60% at 10% 0%, rgba(29, 185, 84, 0.6) 0%, transparent 60%),
      radial-gradient(ellipse 60% 50% at 60% 10%, rgba(80, 40, 180, 0.5) 0%, transparent 55%),
      radial-gradient(ellipse 70% 60% at 90% 20%, rgba(30, 215, 96, 0.35) 0%, transparent 50%),
      radial-gradient(ellipse 50% 40% at 40% 30%, rgba(0, 100, 200, 0.3) 0%, transparent 50%),
      linear-gradient(180deg, rgba(10, 10, 10, 0.3) 60%, #121212 100%);
    background-size: 200% 200%;
    animation: wave-mesh 12s ease-in-out infinite alternate;
  }
  @keyframes wave-mesh {
    0% { background-position: 0% 0%; }
    25% { background-position: 50% 20%; }
    50% { background-position: 100% 10%; }
    75% { background-position: 30% 30%; }
    100% { background-position: 0% 0%; }
  }
  .quick-card {
    display: flex;
    align-items: center;
    gap: 0;
    background: rgba(255,255,255,.07);
    border-radius: 4px;
    overflow: hidden;
    height: 64px;
    position: relative;
  }
  .quick-card:hover {
    background: rgba(255,255,255,.15);
  }
  .quick-card-icon {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .quick-card span {
    padding: 0 16px;
    flex: 1;
    min-width: 0;
  }
  .play-btn {
    position: absolute;
    right: 12px;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #1db954;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 16px rgba(0,0,0,.3);
    opacity: 0;
    transform: translateY(8px);
    transition: opacity 0.3s, transform 0.3s;
  }
  .quick-card:hover .play-btn {
    opacity: 1;
    transform: translateY(0);
  }
  .play-btn:hover {
    background: #1ed760;
    transform: scale(1.04);
  }

  .wave-play-btn {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #1db954;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    transition: transform 0.15s, background 0.15s;
  }
  .wave-play-btn:hover {
    background: #1ed760;
    transform: scale(1.06);
  }
  .wave-play-btn:disabled {
    opacity: 0.7;
    cursor: wait;
  }

  .section {
    margin-bottom: 32px;
  }

  .refresh-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    color: #b3b3b3;
    transition: color 0.15s, background 0.15s;
  }
  .refresh-btn:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.07);
  }
  .refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Track cards (grid layout) */
  .track-card {
    text-align: left;
    padding: 12px;
    border-radius: 8px;
    transition: background 0.2s;
    cursor: pointer;
  }
  .track-card:hover {
    background: rgba(255, 255, 255, 0.07);
  }
  .track-card-art {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    border-radius: 6px;
    overflow: hidden;
    background: #282828;
  }
  .card-play-btn {
    position: absolute;
    right: 8px;
    bottom: 8px;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: #1db954;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
    opacity: 0;
    transform: translateY(8px);
    transition: opacity 0.3s, transform 0.3s;
  }
  .track-card:hover .card-play-btn {
    opacity: 1;
    transform: translateY(0);
  }
  .card-play-btn:hover {
    background: #1ed760;
    transform: scale(1.06);
  }

  /* Skeletons */
  .card-skeleton {
    aspect-ratio: 1;
    border-radius: 8px;
    background: #282828;
    animation: pulse 1.5s ease-in-out infinite;
  }
  .row-skeleton {
    height: 56px;
    border-radius: 6px;
    background: #282828;
    margin-bottom: 4px;
    animation: pulse 1.5s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.7; }
  }
</style>
