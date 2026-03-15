<script lang="ts">
  import TrackRow from '$lib/components/track/TrackRow.svelte';
  import { getLikedTracks } from '$lib/stores/liked.svelte';
  import { play } from '$lib/stores/player.svelte';
  import { downloadTrack, isTrackDownloaded, deleteDownloadedTrack } from '$lib/stores/downloads.svelte';
  import { Play, Heart, Clock3, Search, Download, ListFilter, Check, Loader2, Trash2 } from 'lucide-svelte';
  import { formatDuration } from '$lib/utils/format';
  import { setHeaderColor } from '$lib/stores/headerColor.svelte';
  import { getUsername } from '$lib/stores/username.svelte';
  import { onDestroy } from 'svelte';

  const liked = getLikedTracks();
  const user = getUsername();

  // Set purple gradient for liked songs page
  $effect(() => {
    setHeaderColor([80, 56, 160]);
  });

  onDestroy(() => {
    setHeaderColor(null);
  });

  let filterQuery = $state('');
  let showFilter = $state(false);

  const filteredTracks = $derived(
    filterQuery.trim()
      ? liked.tracks.filter(t =>
          t.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
          t.user.username.toLowerCase().includes(filterQuery.toLowerCase())
        )
      : liked.tracks
  );

  function playAll() {
    if (filteredTracks.length > 0) {
      play(filteredTracks[0], filteredTracks);
    }
  }

  // Download all tracks
  let isDownloadingAll = $state(false);
  let downloadProgress = $state({ current: 0, total: 0 });
  let isHoveringDownloadBtn = $state(false);

  // Check download status of all tracks
  const downloadedCount = $derived(
    liked.tracks.filter(t => isTrackDownloaded(t.id)).length
  );
  const allTracksDownloaded = $derived(
    liked.tracks.length > 0 && downloadedCount === liked.tracks.length
  );
  const someTracksDownloaded = $derived(
    downloadedCount > 0 && downloadedCount < liked.tracks.length
  );

  async function downloadAll() {
    if (isDownloadingAll || liked.tracks.length === 0) return;
    
    isDownloadingAll = true;
    downloadProgress = { current: 0, total: liked.tracks.length };
    
    for (let i = 0; i < liked.tracks.length; i++) {
      const track = liked.tracks[i];
      
      // Skip already downloaded
      if (isTrackDownloaded(track.id)) {
        downloadProgress.current = i + 1;
        continue;
      }
      
      try {
        await downloadTrack(track);
        downloadProgress.current = i + 1;
      } catch (e) {
        console.error(`Failed to download track ${track.id}:`, e);
        // Continue with next track even if one fails
      }
    }
    
    isDownloadingAll = false;
  }

  async function deleteAllDownloads() {
    if (liked.tracks.length === 0) return;
    
    for (const track of liked.tracks) {
      if (isTrackDownloaded(track.id)) {
        try {
          await deleteDownloadedTrack(track.id);
        } catch (e) {
          console.error(`Failed to delete track ${track.id}:`, e);
        }
      }
    }
  }
</script>

<div class="liked-page">
  <!-- Purple gradient header — matches Spotify liked songs -->
  <div class="liked-header">
    <div class="liked-header-content">
      <div class="liked-cover">
        <Heart class="w-20 h-20 text-white fill-current" />
      </div>
      <div class="liked-info">
        <span class="text-sm font-medium text-white/90">Playlist</span>
        <h1 class="liked-title">Liked Songs</h1>
        <div class="flex items-center gap-1 mt-3 text-sm text-white/80">
          <span class="font-bold text-white">{user.value}</span>
          <span>&bull;</span>
          <span>{liked.count} songs</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Controls row -->
  <div class="controls-row">
    <div class="flex items-center gap-4">
      <!-- Big green play button -->
      <button
        onclick={playAll}
        disabled={liked.count === 0}
        class="w-14 h-14 rounded-full bg-[#1db954] hover:bg-[#1ed760] hover:scale-105 flex items-center justify-center shadow-xl disabled:opacity-40 disabled:hover:scale-100"
      >
        <Play class="w-6 h-6 text-black fill-current ml-0.5" />
      </button>

      <!-- Shuffle button (green like screenshot) -->
      <button class="text-[#1db954] hover:text-[#1ed760] hover:scale-105" title="Shuffle">
        <svg class="w-9 h-9" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
        </svg>
      </button>

      <!-- Download button -->
      {#if isDownloadingAll}
        <!-- Downloading state -->
        <button 
          disabled
          class="text-[#1db954] disabled:opacity-100 relative"
          title={`Downloading ${downloadProgress.current}/${downloadProgress.total}`}
        >
          <div class="relative">
            <Loader2 class="w-7 h-7 animate-spin" />
            <span class="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap text-[#1db954]">
              {downloadProgress.current}/{downloadProgress.total}
            </span>
          </div>
        </button>
      {:else if allTracksDownloaded}
        <!-- All downloaded - green with trash on hover -->
        <button 
          onmouseenter={() => isHoveringDownloadBtn = true}
          onmouseleave={() => isHoveringDownloadBtn = false}
          onclick={deleteAllDownloads}
          class="text-[#1db954] hover:text-red-500 transition-colors"
          title="Remove all downloads"
        >
          {#if isHoveringDownloadBtn}
            <Trash2 class="w-7 h-7" />
          {:else}
            <Check class="w-7 h-7" />
          {/if}
        </button>
      {:else if someTracksDownloaded}
        <!-- Partially downloaded -->
        <button 
          onclick={downloadAll}
          disabled={liked.count === 0}
          class="text-[#1db954] hover:text-[#1ed760] disabled:opacity-50 disabled:cursor-not-allowed relative"
          title={`${downloadedCount} of ${liked.tracks.length} downloaded - Click to download remaining`}
        >
          <Download class="w-7 h-7" />
        </button>
      {:else}
        <!-- Nothing downloaded -->
        <button 
          onclick={downloadAll}
          disabled={liked.count === 0}
          class="text-[#b3b3b3] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          title="Download all"
        >
          <Download class="w-7 h-7" />
        </button>
      {/if}
    </div>

    <div class="flex items-center gap-3">
      {#if liked.count > 0}
        {#if showFilter}
          <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#b3b3b3] pointer-events-none" />
            <input
              type="text"
              bind:value={filterQuery}
              placeholder="Search in Liked Songs"
              class="h-8 pl-9 pr-3 bg-[#242424] rounded text-sm text-white placeholder:text-[#b3b3b3] border border-transparent focus:border-white/20 outline-none w-48"
            />
          </div>
        {/if}
        <button
          onclick={() => showFilter = !showFilter}
          class="text-[#b3b3b3] hover:text-white"
        >
          <Search class="w-5 h-5" />
        </button>

        <button class="flex items-center gap-1 text-[#b3b3b3] hover:text-white text-sm">
          <span>Date added</span>
          <ListFilter class="w-4 h-4" />
        </button>
      {/if}
    </div>
  </div>

  {#if liked.count === 0}
    <!-- Empty state -->
    <div class="flex flex-col items-center justify-center py-20 px-8">
      <div class="w-16 h-16 rounded-full bg-[#282828] flex items-center justify-center mb-4">
        <Heart class="w-8 h-8 text-[#b3b3b3]" />
      </div>
      <h2 class="text-xl font-bold text-white mb-2">Songs you like will appear here</h2>
      <p class="text-sm text-[#b3b3b3]">Save songs by tapping the heart icon.</p>
    </div>
  {:else}
    <!-- Table header -->
    <div class="table-header">
      <div class="w-[40px] text-center shrink-0">#</div>
      <div class="flex-1 min-w-0">Title</div>
      <div class="w-8 shrink-0"></div>
      <div class="w-[52px] shrink-0 flex justify-end">
        <Clock3 class="w-4 h-4" />
      </div>
      <div class="w-8 shrink-0"></div>
    </div>

    <div class="px-6 pb-8">
      {#each filteredTracks as track, i (track.id)}
        <TrackRow {track} index={i} trackList={filteredTracks} />
      {/each}
    </div>

    {#if filterQuery && filteredTracks.length === 0}
      <p class="text-center text-[#b3b3b3] text-sm py-8">No results for "{filterQuery}"</p>
    {/if}
  {/if}
</div>

<style>
  .liked-page {
    margin: -24px;
  }
  .liked-header {
    position: relative;
    padding: 32px 32px 24px;
  }
  .liked-header-content {
    position: relative;
    display: flex;
    align-items: flex-end;
    gap: 24px;
  }
  .liked-cover {
    width: 232px;
    height: 232px;
    border-radius: 4px;
    background: linear-gradient(135deg, #450af5, #c4efd9);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 24px rgba(0,0,0,.5);
    flex-shrink: 0;
  }
  .liked-cover :global(svg) {
    width: 80px;
    height: 80px;
  }
  .liked-info {
    flex: 1;
    padding-bottom: 8px;
  }
  .liked-title {
    font-size: clamp(3.5rem, 8.5vw, 6.5rem);
    font-weight: 800;
    color: #fff;
    line-height: 1;
    margin-top: 8px;
    letter-spacing: -0.03em;
    white-space: nowrap;
  }
  .controls-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 32px 8px;
  }
  .table-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 4px 16px;
    margin: 0 24px 4px;
    border-bottom: 1px solid rgba(255,255,255,.1);
    color: #b3b3b3;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: .08em;
    height: 36px;
  }
</style>
