<script lang="ts">
  import { getAuth } from '$lib/stores/auth.svelte';
  import { getPlayer } from '$lib/stores/player.svelte';

  const auth = getAuth();
  const player = getPlayer();
</script>

<div class="max-w-2xl">
  <h1 class="text-3xl font-bold mb-2">Welcome to Symptom</h1>
  <p class="text-text-secondary mb-8">Your SoundCloud desktop player.</p>

  {#if auth.isAuthenticated}
    <div class="space-y-6">
      <div class="p-4 bg-bg-secondary rounded-lg border border-border">
        <h2 class="text-sm font-medium text-text-secondary mb-1">Get started</h2>
        <p class="text-sm text-text-muted">
          Head to <a href="/search" class="text-accent hover:underline">Search</a> to find and play tracks.
        </p>
      </div>

      {#if player.queue.length > 0}
        <div class="p-4 bg-bg-secondary rounded-lg border border-border">
          <h2 class="text-sm font-medium text-text-secondary mb-1">Queue</h2>
          <p class="text-sm text-text-muted">{player.queue.length} tracks in queue</p>
        </div>
      {/if}
    </div>
  {:else}
    <div class="p-4 bg-bg-secondary rounded-lg border border-border">
      <p class="text-sm text-text-muted">
        Go to <a href="/settings" class="text-accent hover:underline">Settings</a> to set up your SoundCloud client ID.
      </p>
    </div>
  {/if}
</div>
