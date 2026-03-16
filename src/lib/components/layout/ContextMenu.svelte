<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Copy, RefreshCw, Heart, ListMusic, Trash2 } from 'lucide-svelte';
  import { toggleLike, isLiked } from '$lib/stores/liked.svelte';
  import { getPlaylists, addTrackToPlaylist } from '$lib/stores/playlists.svelte';
  import type { SCTrack } from '$lib/api/types';
  import { clearTrackSelection, getTrackSelection } from '$lib/stores/trackSelection.svelte';

  let visible = $state(false);
  let x = $state(0);
  let y = $state(0);
  let menuRef = $state<HTMLDivElement | null>(null);
  let targetElement = $state<EventTarget | null>(null);
  let hasSelection = $state(false);
  let menuType = $state<'general' | 'track'>('general');
  let selectedTrack = $state<SCTrack | null>(null);
  let isTrackLiked = $state(false);
  let showPlaylistSubmenu = $state(false);

  const playlists = getPlaylists();
  const selection = getTrackSelection();

  function checkSelection() {
    const selection = window.getSelection();
    hasSelection = selection ? selection.toString().length > 0 : false;
  }

  function handleContextMenu(e: MouseEvent) {
    // Don't show if it's a track context menu (handled separately)
    const target = e.target as HTMLElement;
    if (target.closest('.track-row') || target.closest('[data-track-id]')) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    targetElement = e.target;
    checkSelection();
    menuType = 'general';
    selectedTrack = null;
    showPlaylistSubmenu = false;
    
    const menuWidth = 200;
    const menuHeight = 200;
    
    let posX = e.clientX;
    let posY = e.clientY;
    
    if (posX + menuWidth > window.innerWidth) {
      posX = window.innerWidth - menuWidth - 10;
    }
    if (posY + menuHeight > window.innerHeight) {
      posY = window.innerHeight - menuHeight - 10;
    }
    
    x = posX;
    y = posY;
    visible = true;
  }

  function handleTrackContextMenu(e: CustomEvent) {
    e.preventDefault();
    e.stopPropagation();
    
    const detail = e.detail;
    const isMultiSelect = detail.isMultiSelect;
    
    menuType = 'track';
    selectedTrack = detail.track;
    isTrackLiked = detail.isLiked;
    showPlaylistSubmenu = false;
    
    const menuWidth = 220;
    const menuHeight = isMultiSelect ? 180 : 250;
    
    let posX = detail.x;
    let posY = detail.y;
    
    if (posX + menuWidth > window.innerWidth) {
      posX = window.innerWidth - menuWidth - 10;
    }
    if (posY + menuHeight > window.innerHeight) {
      posY = window.innerHeight - menuHeight - 10;
    }
    
    x = posX;
    y = posY;
    visible = true;
  }

  function handleClick(e: MouseEvent) {
    if (menuRef && !menuRef.contains(e.target as Node)) {
      visible = false;
      showPlaylistSubmenu = false;
      if (menuType === 'track') {
        clearTrackSelection();
      }
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      visible = false;
      showPlaylistSubmenu = false;
    }
  }

  function copy() {
    document.execCommand('copy');
    visible = false;
  }

  function selectAll() {
    if (targetElement instanceof HTMLElement) {
      const input = targetElement as HTMLInputElement | HTMLTextAreaElement;
      if (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') {
        input.select();
      } else {
        const range = document.createRange();
        range.selectNodeContents(input);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
    visible = false;
  }

  function reload() {
    window.location.reload();
  }

  async function handleToggleLike() {
    // Toggle like for all selected tracks
    const trackIds = selection.selectedTrackIds;
    if (trackIds.length > 0) {
      // For multi-select, we need to get the actual tracks
      // For now, just toggle the clicked track if single selection
      if (selectedTrack) {
        await toggleLike(selectedTrack);
      }
    }
    visible = false;
    clearTrackSelection();
  }

  function handleAddToPlaylist(playlistId: string) {
    // Add all selected tracks to playlist
    if (selectedTrack) {
      addTrackToPlaylist(playlistId, selectedTrack);
    }
    visible = false;
    showPlaylistSubmenu = false;
    clearTrackSelection();
  }

  onMount(() => {
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('trackcontextmenu', handleTrackContextMenu as EventListener);
  });

  onDestroy(() => {
    document.removeEventListener('contextmenu', handleContextMenu, true);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('trackcontextmenu', handleTrackContextMenu as EventListener);
  });
</script>

{#if visible}
  <div
    bind:this={menuRef}
    class="custom-context-menu visible"
    style="left: {x}px; top: {y}px;"
  >
    {#if menuType === 'track' && selectedTrack}
      <!-- Track Context Menu -->
      <div class="custom-context-menu-item" onclick={handleToggleLike}>
        <Heart class="w-4 h-4 {isTrackLiked ? 'fill-[#1db954] text-[#1db954]' : ''}" />
        <span>{selection.selectedCount > 1 ? 'Add to Liked' : (isTrackLiked ? 'Remove from Liked' : 'Add to Liked')}</span>
      </div>
      
      <div class="custom-context-menu-divider"></div>
      
      <div 
        class="custom-context-menu-item"
        onmouseenter={() => showPlaylistSubmenu = true}
        onmouseleave={() => showPlaylistSubmenu = false}
      >
        <ListMusic class="w-4 h-4" />
        <span>Add to Playlist</span>
        <svg class="w-3 h-3 ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
        
        {#if showPlaylistSubmenu}
          <div class="custom-context-submenu">
            {#each playlists.list as playlist (playlist.id)}
              <div 
                class="custom-context-menu-item"
                onclick={() => handleAddToPlaylist(playlist.id)}
              >
                <span>{playlist.name}</span>
              </div>
            {/each}
            {#if playlists.list.length === 0}
              <div class="px-3 py-2 text-xs text-[#b3b3b3]">No playlists</div>
            {/if}
          </div>
        {/if}
      </div>
      
      <div class="custom-context-menu-divider"></div>
    {/if}
    
    {#if menuType === 'general'}
      <!-- General Context Menu -->
      {#if hasSelection}
        <div class="custom-context-menu-item" onclick={copy}>
          <Copy class="w-4 h-4" />
          <span>Copy</span>
          <span class="ml-auto text-[#6a6a6a] text-xs">Ctrl+C</span>
        </div>
      {/if}
      
      {#if hasSelection}
        <div class="custom-context-menu-divider"></div>
      {/if}
      
      <div class="custom-context-menu-item" onclick={selectAll}>
        <span>Select All</span>
        <span class="ml-auto text-[#6a6a6a] text-xs">Ctrl+A</span>
      </div>
      
      <div class="custom-context-menu-divider"></div>
    {/if}
    
    <div class="custom-context-menu-item" onclick={reload}>
      <RefreshCw class="w-4 h-4" />
      <span>Reload</span>
      <span class="ml-auto text-[#6a6a6a] text-xs">Ctrl+R</span>
    </div>
  </div>
{/if}