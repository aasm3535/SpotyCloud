<script lang="ts">
  import { getPlayer, togglePlay, next, prev, seek, setVolume, toggleShuffle, cycleRepeat } from '$lib/stores/player.svelte';
  import { getArtworkUrl } from '$lib/utils/image';
  import { formatTime } from '$lib/utils/format';

  const player = getPlayer();

  let showQueue = $state(false);
  let seekBarRef = $state<HTMLDivElement | null>(null);

  function handleSeek(e: MouseEvent) {
    if (!seekBarRef || !player.duration) return;
    const rect = seekBarRef.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seek(pct * player.duration);
  }

  function handleVolumeChange(e: Event) {
    const input = e.target as HTMLInputElement;
    setVolume(parseFloat(input.value));
  }

  $effect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if (e.code === 'ArrowRight' && e.ctrlKey) { e.preventDefault(); next(); }
      if (e.code === 'ArrowLeft' && e.ctrlKey) { e.preventDefault(); prev(); }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });
</script>

<footer class="h-20 bg-bg-secondary border-t border-border flex items-center px-4 gap-4 shrink-0">
  <!-- Left: Track info -->
  <div class="flex items-center gap-3 w-56 min-w-0">
    {#if player.currentTrack}
      {#if player.currentTrack.artwork_url}
        <img
          src={getArtworkUrl(player.currentTrack.artwork_url, 'small')}
          alt=""
          class="w-14 h-14 rounded object-cover shrink-0"
        />
      {:else}
        <div class="w-14 h-14 rounded bg-bg-tertiary flex items-center justify-center shrink-0">
          <svg class="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
      {/if}
      <div class="min-w-0">
        <p class="text-sm font-medium truncate">{player.currentTrack.title}</p>
        <p class="text-xs text-text-secondary truncate">{player.currentTrack.user.username}</p>
      </div>
    {:else}
      <div class="text-sm text-text-muted">No track playing</div>
    {/if}
  </div>

  <!-- Center: Controls + Seekbar -->
  <div class="flex-1 flex flex-col items-center gap-1 max-w-xl">
    <div class="flex items-center gap-3">
      <button
        onclick={toggleShuffle}
        class="p-1.5 rounded-full transition-colors {player.isShuffle ? 'text-accent' : 'text-text-secondary hover:text-text-primary'}"
        title="Shuffle"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 4h4l3 9 3-9h4M4 20h4l3-9 3 9h4" />
        </svg>
      </button>

      <button onclick={prev} class="p-1.5 text-text-secondary hover:text-text-primary transition-colors" title="Previous">
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
        </svg>
      </button>

      <button
        onclick={togglePlay}
        class="w-9 h-9 rounded-full bg-text-primary text-bg-primary flex items-center justify-center hover:scale-105 transition-transform"
        title={player.isPlaying ? 'Pause' : 'Play'}
      >
        {#if player.isLoading}
          <svg class="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round" />
          </svg>
        {:else if player.isPlaying}
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
          </svg>
        {:else}
          <svg class="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        {/if}
      </button>

      <button onclick={next} class="p-1.5 text-text-secondary hover:text-text-primary transition-colors" title="Next">
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
        </svg>
      </button>

      <button
        onclick={cycleRepeat}
        class="p-1.5 rounded-full transition-colors {player.repeatMode !== 'none' ? 'text-accent' : 'text-text-secondary hover:text-text-primary'}"
        title="Repeat: {player.repeatMode}"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        {#if player.repeatMode === 'one'}
          <span class="absolute text-[8px] font-bold">1</span>
        {/if}
      </button>
    </div>

    <!-- Seek bar -->
    <div class="flex items-center gap-2 w-full">
      <span class="text-[11px] text-text-muted w-10 text-right tabular-nums">{formatTime(player.currentTime)}</span>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        bind:this={seekBarRef}
        class="flex-1 h-1 bg-bg-hover rounded-full cursor-pointer group relative"
        onclick={handleSeek}
      >
        <div
          class="h-full bg-text-primary rounded-full group-hover:bg-accent transition-colors relative"
          style="width: {player.duration ? (player.currentTime / player.duration) * 100 : 0}%"
        >
          <div class="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-text-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </div>
      </div>
      <span class="text-[11px] text-text-muted w-10 tabular-nums">{formatTime(player.duration)}</span>
    </div>
  </div>

  <!-- Right: Volume -->
  <div class="flex items-center gap-2 w-40 justify-end">
    <button
      onclick={() => setVolume(player.volume > 0 ? 0 : 0.7)}
      class="p-1.5 text-text-secondary hover:text-text-primary transition-colors"
    >
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        {#if player.volume === 0}
          <path stroke-linecap="round" stroke-linejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
        {:else if player.volume < 0.5}
          <path stroke-linecap="round" stroke-linejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M15.536 8.464a5 5 0 010 7.072" />
        {:else}
          <path stroke-linecap="round" stroke-linejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728" />
        {/if}
      </svg>
    </button>
    <input
      type="range"
      min="0"
      max="1"
      step="0.01"
      value={player.volume}
      oninput={handleVolumeChange}
      class="w-24 h-1 accent-text-primary cursor-pointer"
    />
  </div>
</footer>
