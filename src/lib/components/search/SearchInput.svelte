<script lang="ts">
  import { getSearch, setQuery } from '$lib/stores/search.svelte';
  import { Search, X } from 'lucide-svelte';

  const search = getSearch();
  let inputRef = $state<HTMLInputElement | null>(null);
  let focused = $state(false);

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
  <div class="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none {focused ? 'text-white' : 'text-[#b3b3b3]'} transition-colors">
    <Search class="w-5 h-5" />
  </div>

  <input
    bind:this={inputRef}
    type="text"
    placeholder="What do you want to listen to?"
    value={search.query}
    oninput={handleInput}
    onfocus={() => focused = true}
    onblur={() => focused = false}
    class="w-full h-12 pl-12 pr-12 bg-[#242424] hover:bg-[#2a2a2a] focus:bg-[#333] rounded-full text-sm text-white placeholder:text-[#7f7f7f] border-2 border-transparent hover:border-[#3e3e3e] focus:border-white/30 outline-none transition-all"
  />

  {#if search.query}
    <button
      onclick={clear}
      class="absolute right-4 top-1/2 -translate-y-1/2 text-[#b3b3b3] hover:text-white transition-colors"
      aria-label="Clear search"
    >
      <X class="w-5 h-5" />
    </button>
  {/if}
</div>
