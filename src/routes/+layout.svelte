<script lang="ts">
  import '../app.css';
  import TitleBar from '$lib/components/layout/TitleBar.svelte';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import PlayerBar from '$lib/components/layout/PlayerBar.svelte';
  import ContextMenu from '$lib/components/layout/ContextMenu.svelte';
  import { initAuth, getAuth } from '$lib/stores/auth.svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { getHeaderColor } from '$lib/stores/headerColor.svelte';
  import { initOnboarding, getOnboarding } from '$lib/stores/onboarding.svelte';
  import { initUsername } from '$lib/stores/username.svelte';
  import Onboarding from '$lib/components/layout/Onboarding.svelte';
  import UpdateNotification from '$lib/components/layout/UpdateNotification.svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  import { initStorage } from '$lib/utils/storage';
  import { initLiked } from '$lib/stores/liked.svelte';
  import { initPlaylists } from '$lib/stores/playlists.svelte';
import { initSettings } from '$lib/stores/settings.svelte';
import { initAuthStorage } from '$lib/api/auth';
import { listen } from '@tauri-apps/api/event';
import { next, prev, togglePlay, restoreLastTrack } from '$lib/stores/player.svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
  const auth = getAuth();
  const headerColor = getHeaderColor();
  const onboarding = getOnboarding();
  let storageReady = $state(false);

  let mediaUnsubscribe: (() => void) | null = null;

  onMount(async () => {
    // 1. Load all data from persistent file storage (migrates localStorage)
    await initStorage();
    await Promise.all([
      initLiked(),
      initPlaylists(),
      initSettings(),
      initAuthStorage(),
    ]);

    // 2. NOW init auth/onboarding (after file data is loaded)
    initAuth();
    initOnboarding();
    initUsername();

    // 3. Initialize media session event listener for system media controls
    try {
      mediaUnsubscribe = await listen<string>('media-control', (event) => {
        console.log('[MediaControl] Received:', event.payload);
        switch (event.payload) {
          case 'play':
            togglePlay();
            break;
          case 'pause':
            togglePlay();
            break;
          case 'next':
            next();
            break;
          case 'previous':
            prev();
            break;
        }
      });
    } catch (error) {
      console.error('[MediaControl] Failed to initialize listener:', error);
    }

    storageReady = true;

    // Restore last played track (without auto-playing)
    restoreLastTrack();

    invoke('show_window');
  });
  
  // Cleanup on component destroy
  $effect(() => {
    return () => {
      if (mediaUnsubscribe) {
        mediaUnsubscribe();
      }
    };
  });

  $effect(() => {
    if (storageReady && onboarding.done && !auth.isAuthenticated && $page.url.pathname !== '/settings') {
      goto('/settings');
    }
  });

  const gradientStyle = $derived(
    headerColor.color
      ? `background: linear-gradient(180deg, rgb(${headerColor.color[0]}, ${headerColor.color[1]}, ${headerColor.color[2]}) 0%, rgba(${headerColor.color[0]}, ${headerColor.color[1]}, ${headerColor.color[2]}, 0.6) 30%, rgba(${headerColor.color[0]}, ${headerColor.color[1]}, ${headerColor.color[2]}, 0.2) 55%, #121212 75%);`
      : ''
  );
</script>

<div class="h-screen w-screen flex flex-col bg-black overflow-hidden">
  <UpdateNotification />
  <div class="shrink-0">
    <TitleBar />
  </div>

  <div class="flex-1 flex overflow-hidden px-2 pb-2 gap-2 min-h-0">
    <div class="shrink-0">
      <div class="h-full bg-[#121212] rounded-lg overflow-hidden">
        <Sidebar />
      </div>
    </div>

    <div class="flex-1 min-w-0 min-h-0">
      <div class="h-full bg-[#121212] rounded-lg overflow-hidden">
        <main class="h-full overflow-y-auto overflow-x-hidden relative">
          {#if headerColor.color}
            <div class="main-gradient" style={gradientStyle}></div>
          {/if}
          <div class="p-6 relative z-[1]">
            {#if !onboarding.done}
              <Onboarding />
            {:else}
              {@render children()}
            {/if}
          </div>
        </main>
      </div>
    </div>
  </div>

  <PlayerBar />
</div>

<ContextMenu />

<style>
  .main-gradient {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 500px;
    z-index: 0;
    pointer-events: none;
    transition: background 0.4s ease;
  }
</style>
