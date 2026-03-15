<script lang="ts">
  import SearchInput from '$lib/components/search/SearchInput.svelte';
  import TrackRow from '$lib/components/track/TrackRow.svelte';
  import { getSearch, loadMore, setQuery } from '$lib/stores/search.svelte';
  import { onMount } from 'svelte';

  const search = getSearch();

  onMount(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setQuery(q);
  });

</script>

<div class="max-w-5xl mx-auto">
  <div class="mb-6">
    <h1 class="text-2xl font-extrabold text-white mb-4">Search</h1>
    <SearchInput />
  </div>

  <div class="mt-4">
    {#if search.isLoading && search.results.length === 0}
      <div class="flex items-center justify-center py-20">
        <div class="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
      </div>
    {:else if search.error}
      <div class="py-12 text-center">
        <p class="text-red-400 text-sm">{search.error}</p>
      </div>
    {:else if search.results.length > 0}
      <!-- Top result -->
      <div class="mb-8">
        <h2 class="text-xl font-extrabold text-white mb-4">Top result</h2>
        {#if search.results[0]}
          <TrackRow track={search.results[0]} index={0} trackList={search.results} variant="featured" />
        {/if}
      </div>

      <!-- Songs list -->
      <div class="mb-8">
        <h2 class="text-xl font-extrabold text-white mb-4">Songs</h2>
        <div>
          {#each search.results.slice(1) as track, i (track.id)}
            <TrackRow {track} index={i + 1} trackList={search.results} />
          {/each}
        </div>
      </div>

      {#if search.hasMore}
        <div class="text-center pb-8">
          <button
            onclick={loadMore}
            class="px-6 py-2 text-sm font-bold bg-transparent hover:bg-white/10 text-white rounded-full border border-[#727272] hover:border-white transition-all"
            disabled={search.isLoading}
          >
            {search.isLoading ? 'Loading...' : 'Show more'}
          </button>
        </div>
      {/if}

      <p class="text-center text-[11px] text-[#6a6a6a] pb-4">
        {search.results.length} of {search.totalResults} results
      </p>
    {:else if search.query}
      <div class="py-20 text-center">
        <p class="text-xl font-extrabold text-white mb-2">No results found for "{search.query}"</p>
        <p class="text-sm text-[#b3b3b3]">Please make sure your words are spelled correctly, or use fewer or different keywords.</p>
      </div>
    {:else}
      <div class="py-20 text-center">
        <p class="text-xl font-extrabold text-white mb-2">Search SoundCloud</p>
        <p class="text-sm text-[#b3b3b3]">Find tracks, artists, and more.</p>
      </div>
    {/if}
  </div>
</div>


