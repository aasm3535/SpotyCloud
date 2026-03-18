<script lang="ts">
  import type { SCTrack } from '$lib/api/types';
  import { play, getPlayer } from '$lib/stores/player.svelte';
  import { getArtworkUrl } from '$lib/utils/image';
  import { formatDuration } from '$lib/utils/format';
  import { isLiked, toggleLike } from '$lib/stores/liked.svelte';
  import { getPlaylists, addTrackToPlaylist } from '$lib/stores/playlists.svelte';
  import { getDownloadStatus, isTrackDownloaded, downloadTrack, deleteDownloadedTrack, type DownloadStatus } from '$lib/stores/downloads.svelte';
  import { toggleTrackSelection, clearTrackSelection } from '$lib/stores/trackSelection.svelte';
  import { Play, Pause, Heart, MoreHorizontal, ListMusic, Plus, Download, Check, Trash2 } from 'lucide-svelte';

  interface Props {
    track: SCTrack;
    index?: number;
    trackList?: SCTrack[];
    variant?: 'default' | 'featured';
    playlistId?: string;
    onRemoveFromPlaylist?: () => void;
  }

  let { track, index = 0, trackList, variant = 'default', playlistId, onRemoveFromPlaylist }: Props = $props();

  const player = getPlayer();
  const playlists = getPlaylists();
  const isCurrentTrack = $derived(player.currentTrack?.id === track.id);
  const isPlayingThis = $derived(isCurrentTrack && player.isPlaying);
  const liked = $derived(isLiked(track.id));

  let showMenu = $state(false);
  let showPlaylistSub = $state(false);
  let menuPos = $state({ x: 0, y: 0 });
  let menuBtnRef = $state<HTMLButtonElement | null>(null);
  let rowEl = $state<HTMLElement | null>(null);
  let likeBtnRef = $state<HTMLButtonElement | null>(null);
  let likeAnimating = $state(false);

  // Download state
  const downloadState = $derived(getDownloadStatus(track.id));
  const isDownloaded = $derived(isTrackDownloaded(track.id));
  let showDownloadSub = $state(false);

  async function handleDownload() {
    try {
      await downloadTrack(track);
    } catch (e) {
      console.error('Download failed:', e);
    }
  }

  async function handleDeleteDownload() {
    try {
      await deleteDownloadedTrack(track.id);
    } catch (e) {
      console.error('Delete failed:', e);
    }
  }

  function setupMarquees(root: HTMLElement) {
    root.querySelectorAll<HTMLElement>('.marquee-wrap').forEach(wrap => {
      const text = wrap.querySelector<HTMLElement>('.marquee-text');
      if (!text) return;
      const overflow = text.scrollWidth - wrap.clientWidth;
      if (overflow > 0) {
        wrap.style.setProperty('--marquee-offset', `-${overflow}px`);
        wrap.style.setProperty('--marquee-duration', `${Math.max(3, overflow / 30)}s`);
        wrap.classList.add('has-overflow');
      } else {
        wrap.classList.remove('has-overflow');
        wrap.style.removeProperty('--marquee-offset');
      }
    });
  }

  $effect(() => {
    // re-run when track changes
    track.title;
    if (rowEl) {
      // tick to let DOM update
      requestAnimationFrame(() => setupMarquees(rowEl!));
    }
  });

  function spawnParticles(btn: HTMLButtonElement) {
    const rect = btn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const count = 12;

    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      particle.className = 'like-particle';
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const dist = 18 + Math.random() * 18;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const size = 2 + Math.random() * 2;
      particle.style.cssText = `
        left: ${cx}px; top: ${cy}px;
        width: ${size}px; height: ${size}px;
        --dx: ${dx}px; --dy: ${dy}px;
      `;
      document.body.appendChild(particle);
      particle.addEventListener('animationend', () => particle.remove());
    }
  }

  async function handleLike(e: MouseEvent) {
    e.stopPropagation();
    const wasLiked = liked;
    await toggleLike(track);
    if (!wasLiked && likeBtnRef) {
      likeAnimating = true;
      spawnParticles(likeBtnRef);
      setTimeout(() => (likeAnimating = false), 500);
    }
  }

  function handlePlay() {
    play(track, trackList);
  }

  function handleRowClick(e: MouseEvent) {
    // Only handle Ctrl+Click for selection, regular clicks for play
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      toggleTrackSelection(track.id, true);
    }
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if Ctrl is pressed for multi-selection
    const isMultiSelect = e.ctrlKey || e.metaKey;
    
    // Toggle selection
    toggleTrackSelection(track.id, isMultiSelect);
    
    // Dispatch custom event for ContextMenu
    const event = new CustomEvent('trackcontextmenu', {
      bubbles: true,
      detail: { 
        x: e.clientX, 
        y: e.clientY, 
        track,
        trackList,
        isLiked: liked,
        isMultiSelect
      }
    });
    rowEl?.dispatchEvent(event);
  }

  function openMenu(e: MouseEvent) {
    e.stopPropagation();
    if (menuBtnRef) {
      const rect = menuBtnRef.getBoundingClientRect();
      menuPos = { x: rect.right - 200, y: rect.bottom + 4 };
    }
    showMenu = !showMenu;
    showPlaylistSub = false;
  }

  function closeMenu() {
    showMenu = false;
    showPlaylistSub = false;
    showDownloadSub = false;
  }

  function handleAddToPlaylist(playlistId: string) {
    addTrackToPlaylist(playlistId, track);
    if (menuBtnRef) {
      spawnParticles(menuBtnRef);
    }
    closeMenu();
  }
</script>

{#if variant === 'featured'}
  <!-- Featured / Top Result card -->
  <button
    bind:this={rowEl}
    onclick={handlePlay}
    class="w-full max-w-md p-5 bg-[#181818] hover:bg-[#282828] rounded-lg group text-left relative"
  >
    {#if track.artwork_url}
      <img
        src={getArtworkUrl(track.artwork_url, 'large')}
        alt=""
        class="w-[92px] h-[92px] rounded shadow-lg mb-4 object-cover"
      />
    {:else}
      <div class="w-[92px] h-[92px] rounded bg-[#282828] flex items-center justify-center mb-4">
        <svg class="w-10 h-10 text-[#535353]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      </div>
    {/if}

    <div class="marquee-wrap group/marquee">
      <h3 class="marquee-text text-3xl font-extrabold text-white leading-tight">{track.title}</h3>
    </div>
    <p class="text-sm text-[#b3b3b3] mt-1">{track.user.username} &bull; Song</p>

    <!-- Play button (appears on hover) -->
    <div class="absolute bottom-5 right-5 w-12 h-12 rounded-full bg-[#1db954] hover:bg-[#1ed760] hover:scale-[1.04] flex items-center justify-center shadow-xl translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
      {#if isPlayingThis}
        <Pause class="w-5 h-5 text-black fill-current" />
      {:else}
        <Play class="w-5 h-5 text-black fill-current ml-0.5" />
      {/if}
    </div>
  </button>
{:else}
  <!-- Default list row -->
  <div
    bind:this={rowEl}
    class="track-row group {isCurrentTrack ? 'bg-white/[.06]' : ''}"
    role="row"
    tabindex="0"
    onclick={handleRowClick}
    ondblclick={handlePlay}
    oncontextmenu={handleContextMenu}
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handlePlay();
      }
    }}
  >
    <!-- # / Play icon -->
    <div class="w-[40px] flex items-center justify-center shrink-0 text-center">
      <button class="hidden group-hover:block" onclick={handlePlay}>
        {#if isPlayingThis}
          <Pause class="w-4 h-4 text-white fill-current" />
        {:else}
          <Play class="w-4 h-4 text-white fill-current" />
        {/if}
      </button>
      <span class="group-hover:hidden text-[#b3b3b3] text-sm tabular-nums {isCurrentTrack ? 'text-[#1db954]' : ''}">
        {#if isPlayingThis}
          <!-- Animated bars -->
          <svg width="14" height="14" viewBox="0 0 14 14" fill="#1db954">
            <rect x="1" y="6" width="2" height="8" rx="1">
              <animate attributeName="height" values="2;8;4;6;2" dur="1.2s" repeatCount="indefinite"/>
              <animate attributeName="y" values="12;6;10;8;12" dur="1.2s" repeatCount="indefinite"/>
            </rect>
            <rect x="5" y="4" width="2" height="10" rx="1">
              <animate attributeName="height" values="6;2;8;4;6" dur="1.2s" repeatCount="indefinite"/>
              <animate attributeName="y" values="8;12;6;10;8" dur="1.2s" repeatCount="indefinite"/>
            </rect>
            <rect x="9" y="6" width="2" height="8" rx="1">
              <animate attributeName="height" values="4;6;2;8;4" dur="1.2s" repeatCount="indefinite"/>
              <animate attributeName="y" values="10;8;12;6;10" dur="1.2s" repeatCount="indefinite"/>
            </rect>
          </svg>
        {:else}
          {index + 1}
        {/if}
      </span>
    </div>

    <!-- Artwork + Title -->
    <div class="flex items-center gap-3 flex-1 min-w-0">
      {#if track.artwork_url}
        <img
          src={getArtworkUrl(track.artwork_url, 'small')}
          alt=""
          class="w-10 h-10 rounded object-cover shrink-0"
        />
      {:else}
        <div class="w-10 h-10 rounded bg-[#282828] flex items-center justify-center shrink-0">
          <svg class="w-4 h-4 text-[#535353]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
      {/if}

      <div class="min-w-0 flex-1 flex flex-col justify-center">
        <div class="marquee-wrap">
          <p class="marquee-text text-[14px] font-normal leading-snug {isCurrentTrack ? 'text-[#1db954]' : 'text-white'}">{track.title}</p>
        </div>
        <p class="text-[12px] text-[#a7a7a7] truncate hover:underline hover:text-white cursor-pointer leading-snug">{track.user.username}</p>
      </div>
    </div>

    <!-- Like -->
    <button
      bind:this={likeBtnRef}
      class="like-btn w-8 flex items-center justify-center shrink-0 {liked ? 'text-[#1db954]' : 'text-transparent group-hover:text-[#b3b3b3] hover:!text-white'} {likeAnimating ? 'like-pop' : ''} transition-all duration-200 hover:scale-110"
      onclick={handleLike}
      title={liked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
    >
      <Heart class="w-4 h-4 {liked ? 'fill-current' : ''} transition-all duration-200" />
    </button>

    <!-- Duration -->
    <span class="w-[52px] text-right text-[14px] text-[#a7a7a7] tabular-nums shrink-0">{formatDuration(track.duration)}</span>

    <!-- More button -->
    <button
      bind:this={menuBtnRef}
      class="w-8 flex items-center justify-center shrink-0 text-transparent group-hover:text-[#b3b3b3] hover:!text-white"
      onclick={openMenu}
      title="More options"
    >
      <MoreHorizontal class="w-4 h-4" />
    </button>
  </div>
{/if}

<!-- Track context menu -->
{#if showMenu}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-[200]" onclick={closeMenu}></div>
  <div
    class="track-menu"
    style="left: {menuPos.x}px; top: {menuPos.y}px"
  >
    <!-- Download option — single action, no submenu -->
    {#if downloadState.status === 'downloading'}
      <div class="track-menu-item" style="opacity: 0.6; cursor: default;">
        <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="60" stroke-dashoffset="20" stroke-linecap="round" />
        </svg>
        <span class="flex-1">Downloading...</span>
      </div>
    {:else if isDownloaded}
      <button class="track-menu-item" style="color: #f15e6c;" onclick={() => { handleDeleteDownload(); closeMenu(); }}>
        <Trash2 class="w-4 h-4" />
        <span class="flex-1">Remove download</span>
      </button>
    {:else}
      <button class="track-menu-item" onclick={() => { handleDownload(); closeMenu(); }}>
        <Download class="w-4 h-4" />
        <span class="flex-1">Download</span>
      </button>
    {/if}

    {#if onRemoveFromPlaylist}
      <button class="track-menu-item" style="color: #f15e6c;" onclick={() => { onRemoveFromPlaylist?.(); closeMenu(); }}>
        <Trash2 class="w-4 h-4" />
        <span class="flex-1">Remove from playlist</span>
      </button>
    {/if}

    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="track-menu-item"
      onmouseenter={() => { showPlaylistSub = true; showDownloadSub = false; }}
    >
      <Plus class="w-4 h-4" />
      <span class="flex-1">Add to playlist</span>
      <svg class="w-3 h-3 ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
    </div>

    {#if showPlaylistSub}
      <div class="track-submenu">
        {#each playlists.list as pl (pl.id)}
          <button class="track-menu-item" onclick={() => handleAddToPlaylist(pl.id)}>
            <ListMusic class="w-4 h-4" />
            <span>{pl.name}</span>
          </button>
        {/each}
        {#if playlists.list.length === 0}
          <div class="px-3 py-2 text-xs text-[#b3b3b3]">No playlists yet</div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .track-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 4px 16px;
    border-radius: 4px;
    cursor: default;
    height: 56px;
    min-width: 0;
    overflow: hidden;
  }
  .track-row:hover {
    background: rgba(255,255,255,.1);
  }

  /* Marquee / fade overflow effect */
  .marquee-wrap {
    position: relative;
    overflow: hidden;
  }
  :global(.marquee-wrap.has-overflow) {
    mask-image: linear-gradient(to right, transparent 0px, #000 8px, #000 calc(100% - 24px), transparent 100%);
    -webkit-mask-image: linear-gradient(to right, transparent 0px, #000 8px, #000 calc(100% - 24px), transparent 100%);
  }
  .marquee-text {
    white-space: nowrap;
    display: inline-block;
  }
  :global(.marquee-wrap.has-overflow) .marquee-text {
    animation: marquee-scroll var(--marquee-duration, 5s) ease-in-out 1s infinite alternate;
  }
  @keyframes marquee-scroll {
    0%, 20% { transform: translateX(0); }
    80%, 100% { transform: translateX(var(--marquee-offset, -30%)); }
  }

  :global(.track-menu) {
    position: fixed;
    min-width: 200px;
    background: #282828;
    border-radius: 4px;
    box-shadow: 0 16px 24px rgba(0,0,0,.3), 0 6px 8px rgba(0,0,0,.2);
    padding: 4px;
    z-index: 201;
    animation: tmenu-in 0.15s ease;
  }
  @keyframes tmenu-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  :global(.track-menu-item) {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 10px 12px;
    border-radius: 2px;
    color: #e0e0e0;
    font-size: 13px;
    text-align: left;
    cursor: pointer;
  }
  :global(.track-menu-item:hover) {
    background: rgba(255,255,255,.1);
    color: #fff;
  }
  :global(.track-submenu) {
    border-top: 1px solid rgba(255,255,255,.1);
    padding-top: 4px;
    margin-top: 4px;
    max-height: 200px;
    overflow-y: auto;
  }

  :global(.like-particle) {
    position: fixed;
    pointer-events: none;
    z-index: 9999;
    background: #1db954;
    border-radius: 50%;
    animation: particle-fly 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
  }
  @keyframes particle-fly {
    0% {
      transform: translate(0, 0) scale(0);
      opacity: 1;
    }
    50% {
      transform: translate(var(--dx, 10px), var(--dy, -10px)) scale(1);
      opacity: 1;
    }
    100% {
      transform: translate(calc(var(--dx, 10px) * 1.2), calc(var(--dy, -10px) * 1.2)) scale(0);
      opacity: 0;
    }
  }
</style>
