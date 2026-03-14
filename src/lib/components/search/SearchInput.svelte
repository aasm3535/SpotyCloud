<script lang="ts">
  import { getSearch, setQuery } from '$lib/stores/search.svelte';

  const search = getSearch();
  let inputRef = $state<HTMLInputElement | null>(null);

  function handleInput(e: Event) {
    setQuery((e.target as HTMLInputElement).value);
  }

  function clear() {
    setQuery('');
    inputRef?.focus();
  }

  $effect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        inputRef?.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });
</script>

<div class="relative">
  <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
  <input
    bind:this={inputRef}
    type="text"
    placeholder="Search tracks..."
    value={search.query}
    oninput={handleInput}
    class="w-full pl-10 pr-10 py-2.5 bg-bg-tertiary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors"
  />
  {#if search.query}
    <button
      onclick={clear}
      class="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
    >
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  {/if}
</div>
