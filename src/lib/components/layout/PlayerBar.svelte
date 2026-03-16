<script lang="ts">
  import { getPlayer, togglePlay, next, prev, seek, setVolume, toggleShuffle, cycleRepeat, stopWave, waveDislike } from '$lib/stores/player.svelte';
  import { getArtworkUrl } from '$lib/utils/image';
  import { formatTime } from '$lib/utils/format';
  import { isLiked, toggleLike } from '$lib/stores/liked.svelte';
  import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Volume2, Volume1, VolumeX, Heart, ThumbsUp, ThumbsDown, Radio, X, Timer, Moon, Mic2 } from 'lucide-svelte';
  import { getSleepTimer, startSleepTimer, stopSleepTimer } from '$lib/stores/sleepTimer.svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  const player = getPlayer();
  const sleepTimer = getSleepTimer();
  
  let showSleepTimerMenu = $state(false);
  
  let isLyricsPage = $derived($page.url.pathname === '/lyrics');
  
  const timerOptions = [
    { label: '5 min', value: 5 },
    { label: '10 min', value: 10 },
    { label: '15 min', value: 15 },
    { label: '30 min', value: 30 },
    { label: '45 min', value: 45 },
    { label: '60 min', value: 60 },
  ];
  
  function formatTimeLeft(minutes: number): string {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${minutes}m`;
  }

  function handleLike() {
    if (player.currentTrack) toggleLike(player.currentTrack);
  }

  let seekBarRef = $state<HTMLDivElement | null>(null);
  let isSeeking = $state(false);
  let nowPlayingEl = $state<HTMLDivElement | null>(null);

  function handleSeekStart(e: MouseEvent) {
    isSeeking = true;
    handleSeekMove(e);
  }

  function handleSeekMove(e: MouseEvent) {
    if (!isSeeking || !seekBarRef || !player.duration) return;
    const rect = seekBarRef.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seek(pct * player.duration);
  }

  function handleSeekEnd() {
    isSeeking = false;
  }

  function handleVolumeChange(e: Event) {
    setVolume(parseFloat((e.target as HTMLInputElement).value));
  }

  function handleVolumeWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    const newVolume = Math.max(0, Math.min(1, player.volume + delta));
    setVolume(newVolume);
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

  const progress = $derived(player.duration ? (player.currentTime / player.duration) * 100 : 0);
  const liked = $derived(player.currentTrack ? isLiked(player.currentTrack.id) : false);

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
    player.currentTrack?.title;
    if (nowPlayingEl) {
      requestAnimationFrame(() => setupMarquees(nowPlayingEl!));
    }
  });

  // Update marquee on resize
  $effect(() => {
    const handleResize = () => {
      if (nowPlayingEl) {
        setupMarquees(nowPlayingEl);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  });
</script>

<svelte:window onmousemove={handleSeekMove} onmouseup={handleSeekEnd} />

<footer class="h-[80px] bg-black flex items-center px-4 shrink-0">
  <!-- Left: Now playing -->
  <div class="flex items-center gap-4 w-[30%] min-w-0">
    {#if player.currentTrack}
      {#if player.currentTrack.artwork_url}
        <img
          src={getArtworkUrl(player.currentTrack.artwork_url, 'medium')}
          alt=""
          class="w-16 h-16 rounded-lg shadow-md object-cover shrink-0 bg-[#282828] aspect-square"
        />
      {:else}
        <div class="w-16 h-16 rounded-lg shadow-md bg-[#282828] flex items-center justify-center shrink-0">
          <svg class="w-7 h-7 text-[#535353]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
      {/if}

      <div bind:this={nowPlayingEl} class="min-w-0 flex-1">
        <div class="flex items-center gap-2" style="margin-bottom: -2px;">
          <div class="marquee-wrap min-w-0" style="flex: 0 1 auto; max-width: calc(100% - 44px);">
            <p class="marquee-text text-[15px] font-medium text-white hover:underline cursor-pointer leading-snug">{player.currentTrack.title}</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            {#if player.waveMode}
              <button
                class="like-btn shrink-0 wave-like-btn {liked ? 'text-[#1db954]' : 'text-[#b3b3b3] hover:text-[#1db954]'}"
                title={liked ? 'Liked!' : 'Like this track'}
                onclick={handleLike}
              >
                {#if liked}
                  <ThumbsUp class="w-[18px] h-[18px] fill-current" />
                {:else}
                  <ThumbsUp class="w-[18px] h-[18px]" />
                {/if}
              </button>
              <button
                class="like-btn shrink-0 wave-dislike-btn text-[#b3b3b3] hover:text-[#e85d5d]"
                title="Dislike — skip and don't recommend"
                onclick={() => { if (player.currentTrack) waveDislike(player.currentTrack.id); }}
              >
                <ThumbsDown class="w-[18px] h-[18px]" />
              </button>
            {:else}
              <button
                class="like-btn shrink-0 {liked ? 'text-[#1db954]' : 'text-[#b3b3b3] hover:text-white'}"
                title={liked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
                onclick={handleLike}
              >
                {#if liked}
                  <Heart class="w-[18px] h-[18px] fill-current" />
                {:else}
                  <Heart class="w-[18px] h-[18px]" />
                {/if}
              </button>
            {/if}
          </div>
        </div>
        <div class="flex items-center gap-2">
          <p class="text-[13px] text-[#b3b3b3] truncate hover:underline hover:text-white cursor-pointer leading-snug">{player.currentTrack.user.username}</p>
          {#if player.waveMode}
            <span class="wave-badge">
              <Radio class="w-2.5 h-2.5" />
              Wave
            </span>
          {/if}
        </div>
      </div>
    {:else}
      <div class="w-16 h-16 rounded-lg bg-[#282828] flex items-center justify-center shrink-0 aspect-square">
        <svg class="w-7 h-7 text-[#535353]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      </div>
    {/if}
  </div>

  <!-- Center: Controls + Seekbar -->
  <div class="flex-1 flex flex-col items-center max-w-[45%]">
    {#if player.error}
      <div class="text-[10px] text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full mb-1 truncate max-w-full">
        {player.error}
      </div>
    {/if}

    <div class="flex items-center gap-5">
      <button
        onclick={toggleShuffle}
        class="ctrl-btn {player.isShuffle ? 'shuffle-active' : ''}"
        title="Shuffle"
      >
        <Shuffle class="w-5 h-5" />
        {#if player.isShuffle}
          <span class="active-dot"></span>
        {/if}
      </button>

      <button onclick={prev} class="ctrl-btn text-white" title="Previous">
        <SkipBack class="w-5 h-5 fill-current" />
      </button>

      <button
        onclick={togglePlay}
        class="play-btn"
        title={player.isPlaying ? 'Pause' : 'Play'}
      >
        {#if player.isLoading}
          <div class="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
        {:else if player.isPlaying}
          <Pause class="w-5 h-5 text-black fill-current" />
        {:else}
          <Play class="w-5 h-5 text-black fill-current" />
        {/if}
      </button>

      <button onclick={next} class="ctrl-btn text-white" title="Next">
        <SkipForward class="w-5 h-5 fill-current" />
      </button>

      <button
        onclick={cycleRepeat}
        class="ctrl-btn {player.repeatMode !== 'none' ? 'repeat-active' : ''}"
        title="Repeat"
      >
        {#if player.repeatMode === 'one'}
          <Repeat1 class="w-5 h-5" />
        {:else}
          <Repeat class="w-5 h-5" />
        {/if}
        {#if player.repeatMode !== 'none'}
          <span class="active-dot"></span>
        {/if}
      </button>
    </div>

    <!-- Seek bar -->
    <div class="flex items-center gap-2 w-full mt-2">
      <span class="text-[11px] text-[#a7a7a7] w-10 text-right tabular-nums">{formatTime(player.currentTime)}</span>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        bind:this={seekBarRef}
        class="seek-bar group"
        onmousedown={handleSeekStart}
      >
        <div class="seek-track">
          <div class="seek-fill" style="width: {progress}%">
            <div class="seek-thumb"></div>
          </div>
        </div>
      </div>
      <span class="text-[11px] text-[#a7a7a7] w-10 tabular-nums">{formatTime(player.duration)}</span>
    </div>
  </div>

  <!-- Right: Volume -->
  <div class="flex items-center justify-end gap-2 w-[30%]">
    {#if player.waveMode}
      <button
        onclick={stopWave}
        class="wave-stop-btn"
        title="Stop Wave"
      >
        <Radio class="w-3.5 h-3.5" />
        <X class="w-3 h-3" />
      </button>
    {/if}

    <!-- Lyrics Button -->
    <button
      onclick={() => isLyricsPage ? history.back() : goto('/lyrics')}
      class="ctrl-btn"
      style:color={isLyricsPage ? '#1db954' : undefined}
      title={isLyricsPage ? 'Close lyrics' : 'Show lyrics'}
    >
      <Mic2 class="w-4 h-4" />
    </button>

    <!-- Sleep Timer -->
    <div class="relative">
      <button
        onclick={() => showSleepTimerMenu = !showSleepTimerMenu}
        class="ctrl-btn {sleepTimer.isActive ? 'text-[#1db954]' : ''}"
        title={sleepTimer.isActive ? `Sleep timer: ${formatTimeLeft(sleepTimer.minutesLeft)} left` : 'Sleep timer'}
      >
        {#if sleepTimer.isActive}
          <div class="relative">
            {#if sleepTimer.isFading}
              <span class="text-[10px] font-bold">FADE</span>
            {:else}
              <Timer class="w-4 h-4" />
              <span class="absolute -top-1 -right-1 w-2 h-2 bg-[#1db954] rounded-full animate-pulse"></span>
            {/if}
          </div>
        {:else}
          <Moon class="w-4 h-4" />
        {/if}
      </button>

      {#if showSleepTimerMenu}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <div 
          class="absolute bottom-full right-0 mb-2 bg-[#282828] rounded-lg shadow-xl p-2 min-w-[140px] z-50"
          onclick={(e) => e.stopPropagation()}
        >
          <div class="text-xs text-[#b3b3b3] px-3 py-2 font-medium">Sleep Timer</div>
          {#if sleepTimer.isActive}
            <div class="px-3 py-1 text-sm text-[#1db954] font-medium">
              {#if sleepTimer.isFading}
                <span class="animate-pulse">Fading out...</span>
              {:else}
                {formatTimeLeft(sleepTimer.minutesLeft)} left
              {/if}
            </div>
            <div class="h-px bg-[#3e3e3e] my-1"></div>
          {/if}
          {#each timerOptions as option}
            <button
              onclick={() => { startSleepTimer(option.value); showSleepTimerMenu = false; }}
              class="w-full text-left px-3 py-2 text-sm text-white hover:bg-[#3e3e3e] rounded transition-colors"
              class:bg-[#3e3e3e]={sleepTimer.totalMinutes === option.value && sleepTimer.isActive}
            >
              {option.label}
            </button>
          {/each}
          {#if sleepTimer.isActive}
            <div class="h-px bg-[#3e3e3e] my-1"></div>
            <button
              onclick={() => { stopSleepTimer(); showSleepTimerMenu = false; }}
              class="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-[#3e3e3e] rounded transition-colors"
            >
              Turn Off
            </button>
          {/if}
        </div>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div 
          class="fixed inset-0 z-40" 
          onclick={() => showSleepTimerMenu = false}
        ></div>
      {/if}
    </div>

    <button
      onclick={() => setVolume(player.volume > 0 ? 0 : 0.7)}
      class="ctrl-btn"
      title={player.volume > 0 ? 'Mute' : 'Unmute'}
    >
      {#if player.volume === 0}
        <VolumeX class="w-4 h-4" />
      {:else if player.volume < 0.5}
        <Volume1 class="w-4 h-4" />
      {:else}
        <Volume2 class="w-4 h-4" />
      {/if}
    </button>

    <div class="volume-bar group" onwheel={handleVolumeWheel} role="slider" aria-label="Volume" tabindex="0" aria-valuenow={Math.round(player.volume * 100)}>
      <div class="vol-track">
        <div class="vol-fill" style="width: {player.volume * 100}%">
          <div class="vol-thumb"></div>
        </div>
      </div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={player.volume}
        oninput={handleVolumeChange}
        class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
  </div>
</footer>



<style>
  /* Marquee / fade overflow effect */
  .marquee-wrap {
    position: relative;
    overflow: hidden;
  }
  :global(.marquee-wrap.has-overflow) {
    mask-image: linear-gradient(to right, transparent 0px, #000 8px, #000 calc(100% - 8px), transparent 100%);
    -webkit-mask-image: linear-gradient(to right, transparent 0px, #000 8px, #000 calc(100% - 8px), transparent 100%);
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

  .like-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    transition: color 0.15s ease-out, opacity 0.15s ease-out;
  }
  .like-btn:hover {
    opacity: 0.85;
  }
  .like-btn:active {
    opacity: 0.7;
  }

  /* Wave mode like/dislike buttons */
  .wave-like-btn {
    transition: color 0.15s ease-out, opacity 0.15s ease-out;
  }
  .wave-like-btn:hover {
    opacity: 0.8;
  }
  .wave-like-btn:active {
    opacity: 0.6;
  }
  .wave-dislike-btn {
    transition: color 0.15s ease-out, opacity 0.15s ease-out;
  }
  .wave-dislike-btn:hover {
    opacity: 0.8;
  }
  .wave-dislike-btn:active {
    opacity: 0.6;
  }

  .wave-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #1db954;
    background: rgba(29, 185, 84, 0.15);
    padding: 1px 6px;
    border-radius: 4px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .wave-stop-btn {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 8px;
    border-radius: 9999px;
    color: #1db954;
    background: rgba(29, 185, 84, 0.1);
    font-size: 11px;
    transition: background-color 0.15s ease-out, color 0.15s ease-out;
    flex-shrink: 0;
  }
  .wave-stop-btn:hover {
    background: rgba(29, 185, 84, 0.2);
    color: #1ed760;
  }
  .wave-stop-btn:active {
    background: rgba(29, 185, 84, 0.3);
  }

  .ctrl-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #b3b3b3;
    width: 36px;
    height: 36px;
    border-radius: 9999px;
    transition: color 0.15s ease-out, background-color 0.15s ease-out;
    position: relative;
    flex-shrink: 0;
  }
  .ctrl-btn:hover {
    color: #fff;
    background-color: rgba(255,255,255,0.08);
  }
  .ctrl-btn:active {
    background-color: rgba(255,255,255,0.15);
  }
  .active-dot {
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 4px;
    height: 4px;
    border-radius: 9999px;
    background: #1db954;
  }
  .ctrl-btn.shuffle-active {
    color: #1db954;
    position: relative;
  }
  .ctrl-btn.repeat-active {
    color: #1db954;
    position: relative;
  }

  .play-btn {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    transition: background-color 0.15s ease-out, box-shadow 0.2s ease-out;
  }
  .play-btn:hover {
    background: #c0c0c0;
    box-shadow: 0 4px 16px rgba(0,0,0,0.5);
  }
  .play-btn:active {
    background: #a0a0a0;
  }
  .seek-bar {
    flex: 1;
    height: 12px;
    display: flex;
    align-items: center;
    cursor: pointer;
  }
  .seek-track {
    width: 100%;
    height: 4px;
    background: #4d4d4d;
    border-radius: 2px;
    position: relative;
  }
  .seek-fill {
    height: 100%;
    background: #fff;
    border-radius: 2px;
    position: relative;
    transition: background-color 0.15s;
  }
  .seek-bar:hover .seek-fill {
    background: #1db954;
  }
  .seek-thumb {
    position: absolute;
    right: -6px;
    top: 50%;
    transform: translateY(-50%);
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 2px 4px rgba(0,0,0,.5);
    opacity: 0;
    transition: opacity 0.15s;
  }
  .seek-bar:hover .seek-thumb {
    opacity: 1;
  }
  .volume-bar {
    width: 93px;
    height: 12px;
    display: flex;
    align-items: center;
    position: relative;
    cursor: pointer;
  }
  .vol-track {
    width: 100%;
    height: 4px;
    background: #4d4d4d;
    border-radius: 2px;
    position: relative;
  }
  .vol-fill {
    height: 100%;
    background: #fff;
    border-radius: 2px;
    position: relative;
    transition: background-color 0.15s;
  }
  .volume-bar:hover .vol-fill {
    background: #1db954;
  }
  .vol-thumb {
    position: absolute;
    right: -6px;
    top: 50%;
    transform: translateY(-50%);
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 2px 4px rgba(0,0,0,.5);
    opacity: 0;
    transition: opacity 0.15s;
  }
  .volume-bar:hover .vol-thumb {
    opacity: 1;
  }
</style>
