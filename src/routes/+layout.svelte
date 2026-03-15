<script lang="ts">
  import '../app.css';
  import TitleBar from '$lib/components/layout/TitleBar.svelte';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import PlayerBar from '$lib/components/layout/PlayerBar.svelte';
  import { initAuth, getAuth } from '$lib/stores/auth.svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { getHeaderColor } from '$lib/stores/headerColor.svelte';
  import { initOnboarding, getOnboarding } from '$lib/stores/onboarding.svelte';
  import { initUsername } from '$lib/stores/username.svelte';
  import Onboarding from '$lib/components/layout/Onboarding.svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
  const auth = getAuth();
  const headerColor = getHeaderColor();
  const onboarding = getOnboarding();

  onMount(() => {
    invoke('show_window');
  });

  $effect(() => {
    initAuth();
    initOnboarding();
    initUsername();
  });

  $effect(() => {
    if (!auth.isAuthenticated && $page.url.pathname !== '/settings') {
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
            {@render children()}
          </div>
        </main>
      </div>
    </div>
  </div>

  <PlayerBar />
</div>

{#if !onboarding.done}
  <Onboarding />
{/if}

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
