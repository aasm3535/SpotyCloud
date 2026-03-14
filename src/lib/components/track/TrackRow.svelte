<script lang="ts">
  import type { SCTrack } from '$lib/api/types';
  import { play, addToQueue, getPlayer } from '$lib/stores/player.svelte';
  import { getArtworkUrl } from '$lib/utils/image';
  import { formatDuration, formatCount } from '$lib/utils/format';

  interface Props {
    track: SCTrack;
    index?: number;
    trackList?: SCTrack[];
  }

  let { track, index = 0, trackList }: Props = $props();

  const player = getPlayer();
  const isCurrentTrack = $derived(player.currentTrack?.id === track.id);
</script>

<button
  class="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group
    {isCurrentTrack ? 'bg-bg-active' : 'hover:bg-bg-hover'}"
  onclick={() => play(track, trackList)}
>
  <!-- Index / Play indicator -->
  <div class="w-8 text-center shrink-0">
    {#if isCurrentTrack && player.isPlaying}
      <div class="flex items-center justify-center gap-0.5">
        <span class="w-0.5 h-3 bg-accent rounded-full animate-pulse"></span>
        <span class="w-0.5 h-4 bg-accent rounded-full animate-pulse" style="animation-delay: 0.15s"></span>
        <span class="w-0.5 h-2 bg-accent rounded-full animate-pulse" style="animation-delay: 0.3s"></span>
      </div>
    {:else}
      <span class="text-sm text-text-muted group-hover:hidden">{index + 1}</span>
      <svg class="w-4 h-4 text-text-primary hidden group-hover:block mx-auto" fill="currentColor" viewBox="0 0 24 24">
        <path d="M8 5v14l11-7z" />
      </svg>
    {/if}
  </div>

  <!-- Artwork -->
  {#if track.artwork_url}
    <img
      src={getArtworkUrl(track.artwork_url, 'small')}
      alt=""
      class="w-10 h-10 rounded object-cover shrink-0"
    />
  {:else}
    <div class="w-10 h-10 rounded bg-bg-tertiary flex items-center justify-center shrink-0">
      <svg class="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    </div>
  {/if}

  <!-- Title & Artist -->
  <div class="flex-1 min-w-0 text-left">
    <p class="text-sm font-medium truncate {isCurrentTrack ? 'text-accent' : ''}">{track.title}</p>
    <p class="text-xs text-text-secondary truncate">{track.user.username}</p>
  </div>

  <!-- Plays -->
  <span class="text-xs text-text-muted hidden sm:block w-16 text-right">
    {formatCount(track.playback_count || 0)}
  </span>

  <!-- Duration -->
  <span class="text-xs text-text-muted w-12 text-right tabular-nums">
    {formatDuration(track.duration)}
  </span>

  <!-- Add to queue -->
  <button
    class="p-1.5 text-text-muted hover:text-text-primary opacity-0 group-hover:opacity-100 transition-opacity"
    title="Add to queue"
    onclick={(e: MouseEvent) => { e.stopPropagation(); addToQueue(track); }}
  >
    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  </button>
</button>
