<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { Library, Plus, ArrowRight, Heart, ChevronRight, Music, Folder, ListMusic, Import } from 'lucide-svelte';
  import { getPlayer } from '$lib/stores/player.svelte';
  import { getLikedTracks } from '$lib/stores/liked.svelte';
  import { getPlaylists, createPlaylist } from '$lib/stores/playlists.svelte';
  import { getSettings } from '$lib/stores/settings.svelte';
  import { getArtworkUrl } from '$lib/utils/image';

  const player = getPlayer();
  const liked = getLikedTracks();
  const playlists = getPlaylists();
  const appSettings = getSettings();

  let sidebarWidth = $state(appSettings.alwaysCollapsedSidebar ? 72 : 280);
  let isCollapsed = $state(appSettings.alwaysCollapsedSidebar);

  // React to setting changes
  $effect(() => {
    if (appSettings.alwaysCollapsedSidebar) {
      isCollapsed = true;
      sidebarWidth = MIN_WIDTH;
    }
  });
  let isDragging = $state(false);
  let startX = $state(0);
  let startWidth = $state(0);
  let showCreateMenu = $state(false);
  let createBtnRef = $state<HTMLElement | null>(null);
  let menuPos = $state({ x: 0, y: 0 });

  const MIN_WIDTH = 72;
  const MAX_WIDTH = 420;
  const DEFAULT_WIDTH = 280;

  function handleMouseDown(e: MouseEvent) {
    isDragging = true;
    startX = e.clientX;
    startWidth = sidebarWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging) return;
    const delta = e.clientX - startX;
    let newWidth = startWidth + delta;
    if (newWidth < 150) {
      newWidth = MIN_WIDTH;
      isCollapsed = true;
    } else {
      isCollapsed = false;
      if (newWidth < 200) newWidth = 200;
    }
    sidebarWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));
  }

  function handleMouseUp() {
    isDragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  function toggleCollapse() {
    isCollapsed = !isCollapsed;
    sidebarWidth = isCollapsed ? MIN_WIDTH : DEFAULT_WIDTH;
  }

  function toggleCreateMenu() {
    if (!showCreateMenu && createBtnRef) {
      const rect = createBtnRef.getBoundingClientRect();
      menuPos = { x: rect.left, y: rect.bottom + 8 };
    }
    showCreateMenu = !showCreateMenu;
  }

  function handleCreatePlaylist() {
    const pl = createPlaylist();
    showCreateMenu = false;
    goto(`/playlist/${pl.id}`);
  }

  function closeCreateMenu() {
    showCreateMenu = false;
  }
</script>

<svelte:window onmousemove={handleMouseMove} onmouseup={handleMouseUp} />

<!-- Create menu — rendered at body level via fixed positioning to avoid overflow clip -->
{#if showCreateMenu}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-[200]" onclick={closeCreateMenu}></div>
  <div
    class="create-menu"
    style="left: {menuPos.x}px; top: {menuPos.y}px"
  >
    <button class="create-menu-item" onclick={handleCreatePlaylist}>
      <div class="create-menu-icon">
        <ListMusic class="w-5 h-5" />
      </div>
      <div>
        <p class="menu-title">Playlist</p>
        <p class="menu-sub">Create a playlist with songs</p>
      </div>
    </button>
    <button class="create-menu-item" onclick={() => { showCreateMenu = false; }}>
      <div class="create-menu-icon">
        <Folder class="w-5 h-5" />
      </div>
      <div>
        <p class="menu-title">Folder</p>
        <p class="menu-sub">Organize your playlists</p>
      </div>
    </button>
    <button class="create-menu-item" onclick={() => { showCreateMenu = false; goto('/import'); }}>
      <div class="create-menu-icon">
        <Import class="w-5 h-5" />
      </div>
      <div>
        <p class="menu-title">Import from Spotify</p>
        <p class="menu-sub">Transfer tracks via CSV file</p>
      </div>
    </button>
  </div>
{/if}

<div
  class="sidebar-root"
  style="width: {sidebarWidth}px; transition: {isDragging ? 'none' : 'width 0.15s ease'}"
>
  <!-- Library header -->
  <div class="lib-header" class:collapsed={isCollapsed}>
    <button
      class="lib-header-btn"
      class:collapsed={isCollapsed}
      onclick={toggleCollapse}
    >
      <Library class="w-8 h-8 shrink-0" />
      {#if !isCollapsed}
        <span class="lib-label">Your Library</span>
      {/if}
    </button>

    {#if !isCollapsed}
      <div class="flex items-center gap-1">
        <button
          bind:this={createBtnRef}
          class="create-btn"
          class:open={showCreateMenu}
          title="Create playlist or folder"
          onclick={toggleCreateMenu}
        >
          <Plus class="w-5 h-5" />
        </button>

        <button class="icon-btn" onclick={toggleCollapse} title="Show less">
          <ArrowRight class="w-5 h-5" />
        </button>
      </div>
    {/if}
    {#if isCollapsed}
      <button
        class="expand-hint"
        onclick={toggleCollapse}
      >
        <ChevronRight class="w-4 h-4" />
      </button>
    {/if}
  </div>

  <!-- Library items -->
  <div class="lib-list">
    {#if isCollapsed}
      <button
        bind:this={createBtnRef}
        class="create-btn-collapsed"
        class:open={showCreateMenu}
        title="Create playlist or folder"
        onclick={toggleCreateMenu}
      >
        <Plus class="w-5 h-5" />
      </button>
    {/if}
    <a
      href="/liked"
      class="lib-item"
      class:active={$page.url.pathname === '/liked'}
      class:collapsed={isCollapsed}
    >
      <div class="item-art gradient">
        <Heart class="w-5 h-5 text-white fill-current" />
      </div>
      {#if !isCollapsed}
        <div class="item-text">
          <p class="item-title">Liked Songs</p>
          <p class="item-sub">Playlist &bull; {liked.count} songs</p>
        </div>
      {/if}
    </a>

    {#each playlists.list as pl (pl.id)}
      <a
        href="/playlist/{pl.id}"
        class="lib-item"
        class:active={$page.url.pathname === `/playlist/${pl.id}`}
        class:collapsed={isCollapsed}
      >
        <div class="item-art">
          {#if pl.tracks.length > 0 && pl.tracks[0].artwork_url}
            <img src={getArtworkUrl(pl.tracks[0].artwork_url, 'small')} alt="" class="w-full h-full object-cover rounded" />
          {:else}
            <Music class="w-7 h-7 text-[#7f7f7f]" />
          {/if}
        </div>
        {#if !isCollapsed}
          <div class="item-text">
            <p class="item-title">{pl.name}</p>
            <p class="item-sub">Playlist &bull; {pl.tracks.length} songs</p>
          </div>
        {/if}
      </a>
    {/each}

    {#if player.queue.length > 0}
      <a href="/" class="lib-item" class:collapsed={isCollapsed}>
        <div class="item-art">
          <svg class="w-5 h-5 text-[#b3b3b3]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </div>
        {#if !isCollapsed}
          <div class="item-text">
            <p class="item-title">Queue</p>
            <p class="item-sub">{player.queue.length} tracks</p>
          </div>
        {/if}
      </a>
    {/if}
  </div>

  <button class="resize-handle" onmousedown={handleMouseDown} aria-label="Resize sidebar">
    <div class="resize-bar"></div>
  </button>
</div>

<style>
  .sidebar-root {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #121212;
    position: relative;
    user-select: none;
  }

  .lib-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px 8px;
  }
  .lib-header.collapsed {
    flex-direction: column;
    justify-content: center;
    gap: 8px;
    padding: 20px 0 12px;
  }

  .lib-header-btn {
    display: flex;
    align-items: center;
    gap: 12px;
    color: #b3b3b3;
    font-size: 14px;
    white-space: nowrap;
  }
  .lib-header-btn:hover { color: #fff; }
  .lib-header-btn.collapsed { justify-content: center; width: 100%; }

  .lib-label { font-weight: 700; }

  /* + button that rotates to X */
  .create-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    color: #b3b3b3;
    flex-shrink: 0;
    transition: transform 0.25s cubic-bezier(.4,0,.2,1), color 0.15s, background-color 0.15s;
    padding: 0;
    line-height: 1;
  }
  .create-btn :global(svg) {
    display: block;
    margin: auto;
  }
  .create-btn:hover {
    color: #fff;
    background: rgba(255,255,255,.07);
  }
  .create-btn.open {
    transform: rotate(45deg);
    color: #fff;
  }

  /* Create button for collapsed sidebar — small circle like Spotify */
  .create-btn-collapsed {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    background: #2a2a2a;
    color: #b3b3b3;
    flex-shrink: 0;
    margin: 0 auto 12px;
  }
  .create-btn-collapsed :global(svg) {
    transition: transform 0.25s cubic-bezier(.4,0,.2,1);
  }
  .create-btn-collapsed:hover {
    color: #fff;
    background: #3a3a3a;
  }
  .create-btn-collapsed.open {
    color: #fff;
  }
  .create-btn-collapsed.open :global(svg) {
    transform: rotate(45deg);
  }

  .icon-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    color: #b3b3b3;
    flex-shrink: 0;
  }
  .icon-btn:hover {
    color: #fff;
    background: rgba(255,255,255,.07);
  }

  .expand-hint {
    position: absolute;
    right: -3px;
    top: 50%;
    transform: translateY(-50%);
    width: 6px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #b3b3b3;
    opacity: 0;
    transition: opacity 0.15s;
    z-index: 10;
  }
  .sidebar-root:hover .expand-hint { opacity: 1; }
  .expand-hint:hover { color: #fff; }

  /* Dropdown — fixed position, outside sidebar overflow */
  :global(.create-menu) {
    position: fixed;
    width: 280px;
    background: #282828;
    border-radius: 8px;
    box-shadow: 0 16px 24px rgba(0,0,0,.3), 0 6px 8px rgba(0,0,0,.2);
    padding: 4px;
    z-index: 201;
    animation: menu-in 0.2s cubic-bezier(.4,0,.2,1);
  }
  @keyframes menu-in {
    from { opacity: 0; transform: translateY(-8px) scale(0.95); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  :global(.create-menu-item) {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px;
    border-radius: 4px;
    text-align: left;
  }
  :global(.create-menu-item:hover) {
    background: rgba(255,255,255,.1);
  }
  :global(.create-menu-icon) {
    width: 40px;
    height: 40px;
    border-radius: 4px;
    background: #3e3e3e;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #b3b3b3;
    flex-shrink: 0;
  }
  :global(.menu-title) {
    font-size: 14px;
    font-weight: 700;
    color: #fff;
  }
  :global(.menu-sub) {
    font-size: 11px;
    color: #b3b3b3;
    margin-top: 2px;
  }

  .lib-list {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0 8px 8px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,.1) transparent;
  }

  .lib-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px;
    border-radius: 6px;
    cursor: pointer;
    min-height: 56px;
  }
  .lib-item:hover .item-art,
  .lib-item.active .item-art {
    box-shadow: 0 0 0 4px rgba(255,255,255,0.1);
  }
  .lib-item.collapsed {
    justify-content: center;
    position: relative;
  }

  .item-art {
    width: 48px;
    height: 48px;
    border-radius: 4px;
    background: #282828;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    overflow: hidden;
    transition: box-shadow 0.15s ease;
  }
  .item-art.gradient {
    background: linear-gradient(135deg, #450af5, #c4efd9);
  }

  .item-text { flex: 1; min-width: 0; overflow: hidden; }
  .item-title {
    font-size: 14px; font-weight: 500; color: #fff;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .item-sub {
    font-size: 11px; color: #b3b3b3;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    margin-top: 1px;
  }

  .resize-handle {
    position: absolute; right: 0; top: 0; bottom: 0;
    width: 4px; margin-right: -2px; cursor: col-resize;
    display: flex; align-items: center; justify-content: center;
    z-index: 50; opacity: 0; transition: opacity 0.15s;
  }
  .resize-handle:hover, .resize-handle:active { opacity: 1; }
  .resize-bar {
    width: 2px; height: 32px;
    background: rgba(255,255,255,.3); border-radius: 1px;
  }
</style>
