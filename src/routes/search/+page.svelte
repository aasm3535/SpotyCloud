<script lang="ts">
  import SearchInput from '$lib/components/search/SearchInput.svelte';
  import TrackRow from '$lib/components/track/TrackRow.svelte';
  import { getSearch, loadMore } from '$lib/stores/search.svelte';

  const search = getSearch();
</script>

<div class="max-w-3xl">
  <h1 class="text-2xl font-bold mb-4">Search</h1>

  <SearchInput />

  <div class="mt-6">
    {#if search.isLoading && search.results.length === 0}
      <div class="flex items-center justify-center py-12">
        <svg class="w-6 h-6 animate-spin text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round" />
        </svg>
      </div>
    {:else if search.error}
      <div class="py-8 text-center">
        <p class="text-sm text-red-400">{search.error}</p>
      </div>
    {:else if search.results.length > 0}
      <div class="space-y-0.5">
        {#each search.results as track, i (track.id)}
          <TrackRow {track} index={i} trackList={search.results} />
        {/each}
      </div>

      {#if search.hasMore}
        <div class="mt-4 text-center">
          <button
            onclick={loadMore}
            class="px-4 py-2 text-sm bg-bg-tertiary text-text-secondary hover:text-text-primary rounded-lg transition-colors"
            disabled={search.isLoading}
          >
            {search.isLoading ? 'Loading...' : 'Load more'}
          </button>
        </div>
      {/if}

      <p class="mt-3 text-xs text-text-muted text-center">
        {search.results.length} of {search.totalResults} results
      </p>
    {:else if search.query}
      <div class="py-12 text-center">
        <p class="text-sm text-text-muted">No tracks found for "{search.query}"</p>
      </div>
    {:else}
      <div class="py-12 text-center">
        <p class="text-sm text-text-muted">Search for tracks on SoundCloud</p>
      </div>
    {/if}
  </div>
</div>
