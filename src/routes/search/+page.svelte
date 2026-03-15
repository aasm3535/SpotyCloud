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

  function browseGenre(name: string) {
    setQuery(name);
  }
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
      <!-- Browse categories -->
      <div>
        <h2 class="text-xl font-extrabold text-white mb-6">Browse all</h2>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {#each [
            { name: 'Pop', from: '#e13300', to: '#ff6f61', icon: '🎤' },
            { name: 'Hip-Hop', from: '#ba5d07', to: '#f59e2b', icon: '🔥' },
            { name: 'Rock', from: '#1e3264', to: '#3b5998', icon: '🎸' },
            { name: 'Electronic', from: '#8400a8', to: '#c850c0', icon: '🎛️' },
            { name: 'Indie', from: '#2e6b3a', to: '#56ab2f', icon: '🌿' },
            { name: 'Jazz', from: '#477d95', to: '#86c5da', icon: '🎷' },
            { name: 'Classical', from: '#3a1c71', to: '#7b4397', icon: '🎻' },
            { name: 'K-Pop', from: '#b91d73', to: '#f857a6', icon: '💫' },
            { name: 'Lo-Fi', from: '#3b3b3b', to: '#6d6d6d', icon: '☕' },
            { name: 'Ambient', from: '#0f2027', to: '#2c5364', icon: '🌊' },
            { name: 'Latin', from: '#d4418e', to: '#ef629f', icon: '💃' },
            { name: 'Podcast', from: '#452c63', to: '#6d538a', icon: '🎙️' },
          ] as genre}
            <button
              onclick={() => browseGenre(genre.name)}
              class="genre-card group"
              style="background: linear-gradient(135deg, {genre.from}, {genre.to})"
            >
              <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
              <div class="relative z-10">
                <span class="text-2xl mb-2 block">{genre.icon}</span>
                <span class="text-lg font-extrabold text-white block">{genre.name}</span>
              </div>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .genre-card {
    position: relative;
    height: 140px;
    border-radius: 8px;
    overflow: hidden;
    padding: 16px;
    text-align: left;
    display: flex;
    align-items: flex-start;
    transition: transform 0.2s, filter 0.2s;
  }
  .genre-card:hover {
    transform: scale(1.03);
    filter: brightness(1.15);
  }
</style>

