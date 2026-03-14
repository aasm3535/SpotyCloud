<script lang="ts">
  import '../app.css';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import PlayerBar from '$lib/components/layout/PlayerBar.svelte';
  import { initAuth, getAuth } from '$lib/stores/auth.svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
  const auth = getAuth();

  $effect(() => {
    initAuth();
  });

  $effect(() => {
    if (!auth.isAuthenticated && $page.url.pathname !== '/settings') {
      goto('/settings');
    }
  });
</script>

<div class="flex h-screen overflow-hidden">
  <Sidebar />
  <div class="flex-1 flex flex-col min-w-0">
    <main class="flex-1 overflow-y-auto p-6">
      {@render children()}
    </main>
    <PlayerBar />
  </div>
</div>
