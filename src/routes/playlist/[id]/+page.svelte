<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import TrackRow from '$lib/components/track/TrackRow.svelte';
  import { getPlaylistById, renamePlaylist, deletePlaylist, removeTrackFromPlaylist, removeTracksFromPlaylistBatch } from '$lib/stores/playlists.svelte';
  import { play, getPlayer, togglePlay } from '$lib/stores/player.svelte';
  import { searchTracks } from '$lib/api/soundcloud';
  import { likeTracksBatch } from '$lib/stores/liked.svelte';
  import { Play, Pause, Clock3, Search, X, MoreHorizontal, Trash2, Music, Pencil, Heart, CheckSquare, Square, XCircle } from 'lucide-svelte';
  import type { SCTrack } from '$lib/api/types';
  import { addTrackToPlaylist } from '$lib/stores/playlists.svelte';
  import { extractDominantColor } from '$lib/utils/color';
  import { setHeaderColor } from '$lib/stores/headerColor.svelte';
  import { getUsername } from '$lib/stores/username.svelte';
  import { getArtworkUrl } from '$lib/utils/image';
  import { formatDuration } from '$lib/utils/format';
  import { onDestroy } from 'svelte';

  const player = getPlayer();
  const user = getUsername();
  const playlistId = $derived($page.params.id ?? '');
  const playlist = $derived(getPlaylistById(playlistId));
  const isPlayingFromThis = $derived(
    playlist && player.isPlaying && playlist.tracks.some(t => t.id === player.currentTrack?.id)
  );

  let isEditingName = $state(false);
  let editName = $state('');
  let searchQuery = $state('');
  let searchResults = $state<SCTrack[]>([]);
  let isSearching = $state(false);
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;
  let showMoreMenu = $state(false);
  let moreBtnRef = $state<HTMLButtonElement | null>(null);
  let moreMenuPos = $state({ x: 0, y: 0 });
  let headerColor = $state<[number, number, number]>([83, 83, 83]);

  // ---- Selection state ----
  let selectedIds = $state<Set<number>>(new Set());
  let lastClickedIndex = $state<number>(-1);
  let selectionMode = $state(false);
  const selectedCount = $derived(selectedIds.size);
  const allSelected = $derived(playlist ? selectedIds.size === playlist.tracks.length && playlist.tracks.length > 0 : false);

  // Extract dominant color from first track's artwork
  const artworkUrl = $derived(
    playlist && playlist.tracks.length > 0 && playlist.tracks[0].artwork_url
      ? playlist.tracks[0].artwork_url.replace('-large', '-t200x200')
      : ''
  );

  $effect(() => {
    if (artworkUrl) {
      extractDominantColor(artworkUrl).then(c => {
        headerColor = c;
        setHeaderColor(c);
      });
    } else {
      headerColor = [83, 83, 83];
      setHeaderColor([83, 83, 83]);
    }
  });

  // Clear selection when switching playlists
  $effect(() => {
    playlistId;
    selectedIds = new Set();
    lastClickedIndex = -1;
    selectionMode = false;
  });

  onDestroy(() => {
    setHeaderColor(null);
  });

  function startEditName() {
    if (!playlist) return;
    editName = playlist.name;
    isEditingName = true;
  }

  function saveName() {
    if (playlist && editName.trim()) {
      renamePlaylist(playlist.id, editName.trim());
    }
    isEditingName = false;
  }

  function handleNameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') saveName();
    if (e.key === 'Escape') isEditingName = false;
  }

  function playAll() {
    if (playlist && playlist.tracks.length > 0) {
      if (isPlayingFromThis) {
        togglePlay();
      } else {
        play(playlist.tracks[0], playlist.tracks);
      }
    }
  }

  function toggleMoreMenu(e: MouseEvent) {
    e.stopPropagation();
    if (!showMoreMenu && moreBtnRef) {
      const rect = moreBtnRef.getBoundingClientRect();
      moreMenuPos = { x: rect.left, y: rect.bottom + 8 };
    }
    showMoreMenu = !showMoreMenu;
  }

  function handleDelete() {
    showMoreMenu = false;
    if (playlist) {
      deletePlaylist(playlist.id);
      goto('/');
    }
  }

  function handleSearchInput(e: Event) {
    const q = (e.target as HTMLInputElement).value;
    searchQuery = q;
    if (searchTimeout) clearTimeout(searchTimeout);
    if (!q.trim()) { searchResults = []; return; }
    searchTimeout = setTimeout(async () => {
      isSearching = true;
      try {
        const data = await searchTracks(q, 10);
        searchResults = data.collection;
      } catch { searchResults = []; }
      isSearching = false;
    }, 300);
  }

  function addTrack(track: SCTrack) {
    if (playlist) addTrackToPlaylist(playlist.id, track);
  }

  // ---- Selection logic ----
  function toggleSelect(trackId: number, index: number, e?: MouseEvent) {
    const newSet = new Set(selectedIds);

    if (e?.shiftKey && lastClickedIndex >= 0 && playlist) {
      // Shift+click: range select
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      for (let i = start; i <= end; i++) {
        newSet.add(playlist.tracks[i].id);
      }
    } else {
      // Toggle single
      if (newSet.has(trackId)) {
        newSet.delete(trackId);
      } else {
        newSet.add(trackId);
      }
    }

    selectedIds = newSet;
    lastClickedIndex = index;

    // Auto-enter/exit selection mode
    if (newSet.size > 0) selectionMode = true;
    if (newSet.size === 0) selectionMode = false;
  }

  function toggleSelectAll() {
    if (!playlist) return;
    if (allSelected) {
      selectedIds = new Set();
      selectionMode = false;
    } else {
      selectedIds = new Set(playlist.tracks.map(t => t.id));
      selectionMode = true;
    }
  }

  function clearSelection() {
    selectedIds = new Set();
    lastClickedIndex = -1;
    selectionMode = false;
  }

  function deleteSelected() {
    if (!playlist || selectedIds.size === 0) return;
    removeTracksFromPlaylistBatch(playlist.id, [...selectedIds]);
    clearSelection();
  }

  function likeSelected() {
    if (!playlist || selectedIds.size === 0) return;
    const tracks = playlist.tracks.filter(t => selectedIds.has(t.id));
    likeTracksBatch(tracks);
    clearSelection();
  }

  function removeTrack(trackId: number) {
    if (!playlist) return;
    removeTrackFromPlaylist(playlist.id, trackId);
    if (selectedIds.has(trackId)) {
      const newSet = new Set(selectedIds);
      newSet.delete(trackId);
      selectedIds = newSet;
      if (newSet.size === 0) selectionMode = false;
    }
  }

  // Keyboard: Escape to clear selection
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && selectionMode) {
      clearSelection();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if playlist}
  <div class="playlist-page">
    <!-- Header -->
    <div class="playlist-header">
      <div class="playlist-cover">
        {#if playlist.tracks.length > 0 && playlist.tracks[0].artwork_url}
          <img src={playlist.tracks[0].artwork_url.replace('-large', '-t500x500')} alt="" class="w-full h-full object-cover" />
        {:else}
          <Music class="w-16 h-16 text-[#7f7f7f]" />
        {/if}
      </div>
      <div class="playlist-info">
        <span class="text-xs font-medium text-white/70">Playlist</span>
        {#if isEditingName}
          <input
            type="text"
            bind:value={editName}
            onblur={saveName}
            onkeydown={handleNameKeydown}
            class="playlist-name-input"
          />
        {:else}
          <button onclick={startEditName} class="playlist-name">{playlist.name}</button>
        {/if}
        <div class="flex items-center gap-1 mt-2 text-sm text-white/70">
          <span class="font-bold text-white">{user.value}</span>
          <span>&bull; {playlist.tracks.length} songs</span>
        </div>
      </div>
    </div>

    <!-- Controls -->
    <div class="playlist-controls">
      <div class="flex items-center gap-4">
        <button
          onclick={playAll}
          disabled={playlist.tracks.length === 0}
          class="w-14 h-14 rounded-full bg-[#1db954] hover:bg-[#1ed760] hover:scale-105 flex items-center justify-center shadow-xl disabled:opacity-40 transition-transform"
        >
          {#if isPlayingFromThis}
            <Pause class="w-6 h-6 text-black fill-current" />
          {:else}
            <Play class="w-6 h-6 text-black fill-current ml-0.5" />
          {/if}
        </button>
        <button bind:this={moreBtnRef} onclick={toggleMoreMenu} class="text-[#b3b3b3] hover:text-white" title="More options">
          <MoreHorizontal class="w-7 h-7" />
        </button>
      </div>
    </div>

    <!-- Selection action bar -->
    {#if selectionMode}
      <div class="selection-bar">
        <div class="sel-left">
          <button onclick={toggleSelectAll} class="sel-check" title={allSelected ? 'Deselect all' : 'Select all'}>
            {#if allSelected}
              <CheckSquare class="w-5 h-5" />
            {:else}
              <Square class="w-5 h-5" />
            {/if}
          </button>
          <span class="sel-count">{selectedCount} selected</span>
        </div>
        <div class="sel-actions">
          <button onclick={likeSelected} class="sel-btn like" title="Add to Liked Songs">
            <Heart class="w-4 h-4" />
            <span>Like</span>
          </button>
          <button onclick={deleteSelected} class="sel-btn delete" title="Remove from playlist">
            <Trash2 class="w-4 h-4" />
            <span>Remove</span>
          </button>
          <button onclick={clearSelection} class="sel-btn cancel" title="Cancel">
            <XCircle class="w-4 h-4" />
          </button>
        </div>
      </div>
    {/if}

    <!-- Tracks -->
    {#if playlist.tracks.length > 0}
      <div class="table-header">
        {#if selectionMode}
          <div class="w-[32px] shrink-0"></div>
        {/if}
        <div class="w-[40px] text-center shrink-0">#</div>
        <div class="flex-1 min-w-0">Title</div>
        <div class="w-[40px] shrink-0"></div>
        <div class="w-[56px] shrink-0 flex justify-end">
          <Clock3 class="w-4 h-4" />
        </div>
      </div>
      <div class="px-6 pb-4">
        {#each playlist.tracks as track, i (track.id)}
          <div
            class="select-row"
            class:selected={selectedIds.has(track.id)}
            class:selection-active={selectionMode}
          >
            {#if selectionMode}
              <button
                class="select-checkbox"
                onclick={(e) => { e.stopPropagation(); toggleSelect(track.id, i, e); }}
              >
                {#if selectedIds.has(track.id)}
                  <CheckSquare class="w-4 h-4 text-[#1db954]" />
                {:else}
                  <Square class="w-4 h-4 text-[#b3b3b3]" />
                {/if}
              </button>
            {:else}
              <button
                class="select-checkbox-hover"
                onclick={(e) => { e.stopPropagation(); toggleSelect(track.id, i, e); }}
                title="Select"
              >
                <Square class="w-3.5 h-3.5 text-[#666]" />
              </button>
            {/if}
            <div class="select-row-content">
              <TrackRow {track} index={i} trackList={playlist.tracks} playlistId={playlistId} onRemoveFromPlaylist={() => removeTrack(track.id)} />
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Search to add tracks -->
    <div class="px-8 py-6 border-t border-white/5">
      <h3 class="text-lg font-bold text-white mb-4">Let's find something for your playlist</h3>
      <div class="relative max-w-md flex items-center">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#b3b3b3] pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          oninput={handleSearchInput}
          placeholder="Search for songs or episodes"
          class="w-full h-10 pl-10 pr-10 bg-[#242424] hover:bg-[#2a2a2a] focus:bg-[#333] rounded text-sm text-white placeholder:text-[#7f7f7f] border border-transparent focus:border-white/20 outline-none"
        />
        {#if searchQuery}
          <button onclick={() => { searchQuery = ''; searchResults = []; }} class="absolute right-3 top-1/2 -translate-y-1/2 text-[#b3b3b3] hover:text-white">
            <X class="w-4 h-4" />
          </button>
        {/if}
      </div>

      {#if isSearching}
        <div class="mt-4 text-sm text-[#b3b3b3]">Searching...</div>
      {/if}

      {#if searchResults.length > 0}
        <div class="mt-4 space-y-1">
          {#each searchResults as track (track.id)}
            <div class="flex items-center gap-3 px-3 py-2 hover:bg-white/5 rounded group">
              {#if track.artwork_url}
                <img src={track.artwork_url.replace('-large', '-small')} alt="" class="w-10 h-10 rounded object-cover shrink-0" />
              {:else}
                <div class="w-10 h-10 rounded bg-[#282828] shrink-0"></div>
              {/if}
              <div class="flex-1 min-w-0">
                <p class="text-sm text-white truncate">{track.title}</p>
                <p class="text-[11px] text-[#b3b3b3] truncate">{track.user.username}</p>
              </div>
              <button
                onclick={() => addTrack(track)}
                class="px-3 py-1 text-sm font-bold border border-white/30 rounded-full text-white hover:border-white hover:scale-105"
              >
                Add
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  {#if showMoreMenu}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="fixed inset-0 z-[200]" onclick={() => showMoreMenu = false}></div>
    <div class="pl-more-menu" style="left: {moreMenuPos.x}px; top: {moreMenuPos.y}px">
      <button class="pl-more-item" onclick={() => { showMoreMenu = false; startEditName(); }}>
        <Pencil class="w-4 h-4" />
        <span>Rename</span>
      </button>
      <button class="pl-more-item pl-more-danger" onclick={handleDelete}>
        <Trash2 class="w-4 h-4" />
        <span>Delete</span>
      </button>
    </div>
  {/if}
{:else}
  <div class="flex flex-col items-center justify-center py-20">
    <p class="text-xl font-bold text-white">Playlist not found</p>
    <a href="/" class="mt-4 text-[#b3b3b3] hover:text-white text-sm">Go home</a>
  </div>
{/if}

<style>
  .playlist-page {
    margin: -24px;
  }
  .playlist-header {
    display: flex;
    align-items: flex-end;
    gap: 24px;
    padding: 32px 32px 24px;
  }
  .playlist-cover {
    width: 232px;
    height: 232px;
    border-radius: 4px;
    background: #282828;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 24px rgba(0,0,0,.5);
    flex-shrink: 0;
    overflow: hidden;
  }
  .playlist-info {
    flex: 1;
    min-width: 0;
    padding-bottom: 8px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }
  .playlist-name {
    font-size: clamp(2rem, 5vw, 5rem);
    font-weight: 900;
    color: #fff;
    line-height: 1;
    margin-top: 8px;
    text-align: left;
    cursor: text;
  }
  .playlist-name:hover {
    text-decoration: underline;
  }
  .playlist-name-input {
    font-size: clamp(2rem, 5vw, 5rem);
    font-weight: 900;
    color: #fff;
    line-height: 1;
    margin-top: 8px;
    background: transparent;
    border: none;
    border-bottom: 2px solid #fff;
    outline: none;
    width: 100%;
  }
  .playlist-controls {
    padding: 20px 32px 8px;
  }
  .table-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 4px 22px;
    margin: 0 24px 4px;
    border-bottom: 1px solid rgba(255,255,255,.1);
    color: #b3b3b3;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: .08em;
    height: 36px;
  }

  /* Selection row */
  .select-row {
    display: flex;
    align-items: center;
    border-radius: 4px;
    position: relative;
  }
  .select-row.selected {
    background: rgba(29, 185, 84, 0.08);
  }
  .select-row.selected:hover {
    background: rgba(29, 185, 84, 0.12);
  }

  .select-checkbox {
    width: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    cursor: pointer;
  }

  /* Hidden checkbox that appears on hover when NOT in selection mode */
  .select-checkbox-hover {
    width: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .select-row:hover .select-checkbox-hover {
    opacity: 1;
  }

  .select-row-content {
    flex: 1;
    min-width: 0;
  }

  /* Selection action bar */
  .selection-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 4px 24px 8px;
    padding: 10px 16px;
    background: #1db954;
    border-radius: 8px;
    animation: sel-bar-in 0.2s ease;
  }
  @keyframes sel-bar-in {
    from { opacity: 0; transform: translateY(-6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .sel-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .sel-check {
    color: #000;
    display: flex;
    align-items: center;
  }
  .sel-check :global(svg) {
    color: #000 !important;
  }
  .sel-count {
    font-size: 14px;
    font-weight: 700;
    color: #000;
  }

  .sel-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .sel-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 14px;
    border-radius: 9999px;
    font-size: 13px;
    font-weight: 700;
    transition: all 0.15s;
  }
  .sel-btn.like {
    background: rgba(0, 0, 0, 0.2);
    color: #000;
  }
  .sel-btn.like:hover {
    background: rgba(0, 0, 0, 0.35);
  }
  .sel-btn.delete {
    background: rgba(0, 0, 0, 0.2);
    color: #000;
  }
  .sel-btn.delete:hover {
    background: rgba(200, 30, 30, 0.6);
    color: #fff;
  }
  .sel-btn.cancel {
    background: transparent;
    color: rgba(0, 0, 0, 0.6);
    padding: 6px;
  }
  .sel-btn.cancel:hover {
    color: #000;
  }

  @media (max-width: 500px) {
    .sel-btn span { display: none; }
    .sel-btn { padding: 6px 8px; }
    .playlist-header { flex-direction: column; align-items: center; gap: 16px; padding: 24px 16px; }
    .playlist-cover { width: 160px; height: 160px; }
  }

  :global(.pl-more-menu) {
    position: fixed;
    min-width: 180px;
    background: #282828;
    border-radius: 4px;
    box-shadow: 0 16px 24px rgba(0,0,0,.3), 0 6px 8px rgba(0,0,0,.2);
    padding: 4px;
    z-index: 201;
    animation: pl-menu-in 0.15s ease;
  }
  @keyframes pl-menu-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  :global(.pl-more-item) {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 10px 12px;
    border-radius: 2px;
    color: #e0e0e0;
    font-size: 13px;
    text-align: left;
  }
  :global(.pl-more-item:hover) {
    background: rgba(255,255,255,.1);
    color: #fff;
  }
  :global(.pl-more-danger) {
    color: #f15e6c;
  }
  :global(.pl-more-danger:hover) {
    color: #ff7a85;
    background: rgba(241,94,108,.1);
  }
</style>
