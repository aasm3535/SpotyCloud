<script lang="ts">
  import { getPlayer, seek } from '$lib/stores/player.svelte';
  import { fetchLyrics, getCurrentLine, type LyricsData } from '$lib/api/lyrics';
  import { getArtworkUrl } from '$lib/utils/image';
  import { Loader2 } from 'lucide-svelte';
  import { setHeaderColor } from '$lib/stores/headerColor.svelte';
  import { getSettings } from '$lib/stores/settings.svelte';

  const player = getPlayer();
  const settings = getSettings();

  let lyrics = $state<LyricsData | null>(null);
  let isLoading = $state(true);
  let currentLineIndex = $state(-1);
  let container = $state<HTMLDivElement | null>(null);
  let lastTrackId = $state('');

  $effect(() => {
    setHeaderColor(null);
  });

  $effect(() => {
    const track = player.currentTrack;
    if (track) {
      const trackId = `${track.id}`;
      if (trackId !== lastTrackId) {
        lastTrackId = trackId;
        loadLyrics(track.title, track.user.username, track.duration);
      }
    }
  });

  $effect(() => {
    const timeMs = player.currentTime * 1000;
    if (lyrics?.lines) {
      currentLineIndex = getCurrentLine(lyrics.lines, timeMs);
    }
  });

  // Auto-scroll to current line - optimized for minimal delay
  $effect(() => {
    const idx = currentLineIndex;
    const cont = container;
    if (idx >= 0 && cont && lyrics?.lines) {
      // Use requestAnimationFrame for minimal delay
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

  async function loadLyrics(title: string, artist: string, duration?: number) {
    isLoading = true;
    lyrics = null;
    currentLineIndex = -1;

    try {
      const data = await fetchLyrics(title, artist, duration);
      lyrics = data;
    } catch (e) {
      console.error('Failed to load lyrics:', e);
    } finally {
      isLoading = false;
    }
  }

  function handleLineClick(index: number) {
    if (lyrics?.lines[index]) {
      seek(lyrics.lines[index].time / 1000);
    }
  }
</script>

<div class="lyrics-page">
  <!-- Blurred Background -->
  {#if player.currentTrack?.artwork_url}
    <div class="bg-blur" style="background-image: url({getArtworkUrl(player.currentTrack.artwork_url, 'large')})"></div>
  {/if}

  <div class="lyrics-wrapper" bind:this={container}>
    {#if isLoading}
      <div class="center-content">
        <Loader2 class="w-10 h-10 animate-spin text-[#1db954]" />
        <p class="mt-4 text-[#b3b3b3]">Searching for lyrics...</p>
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
</div>

<style>
  .lyrics-page {
    position: relative;
    min-height: calc(100vh - 160px);
    margin: -24px;
    padding: 24px;
    padding-bottom: 90px;
    overflow: hidden;
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
    overflow-y: auto;
    overflow-x: hidden;
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
</style>
