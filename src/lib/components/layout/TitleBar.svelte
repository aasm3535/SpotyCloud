<script lang="ts">
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { exit } from '@tauri-apps/plugin-process';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { setQuery } from '$lib/stores/search.svelte';
  import { getSettings } from '$lib/stores/settings.svelte';

  const appSettings = getSettings();
  let isMaximized = $state(false);
  let searchQuery = $state('');
  let searchFocused = $state(false);

  $effect(() => {
    getCurrentWindow().isMaximized().then(v => isMaximized = v);
  });

  async function minimize() {
    await getCurrentWindow().minimize();
  }

  async function maximize() {
    const win = getCurrentWindow();
    if (await win.isMaximized()) await win.unmaximize();
    else await win.maximize();
    isMaximized = await win.isMaximized();
  }

  async function close() {
    if (appSettings.closeToTray) {
      await getCurrentWindow().hide();
    } else {
      await exit(0);
    }
  }

  function handleSearch() {
    if (searchQuery.trim()) {
      setQuery(searchQuery.trim());
      goto(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleSearch();
  }

  function goBack() {
    history.back();
  }

  function goForward() {
    history.forward();
  }

  function goHome() {
    goto('/');
  }

  const isHome = $derived($page.url.pathname === '/');
</script>

<div class="titlebar" data-tauri-drag-region>
  <!-- Left: Nav arrows -->
  <div class="left-section no-drag">
    <button onclick={goBack} class="nav-btn" aria-label="Go back" title="Go back">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 18l-6-6 6-6"/>
      </svg>
    </button>

    <button onclick={goForward} class="nav-btn" aria-label="Go forward" title="Go forward">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </button>
  </div>

  <!-- Center: Home + Search -->
  <div class="center-section no-drag">
    <!-- Home button -->
    <button onclick={goHome} class="home-btn" class:active={isHome} aria-label="Home" title="Home">
      {#if isHome}
        <!-- Filled home -->
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13.5 1.515a3 3 0 00-3 0L3 5.845a2 2 0 00-1 1.732V21a1 1 0 001 1h6a1 1 0 001-1v-6h4v6a1 1 0 001 1h6a1 1 0 001-1V7.577a2 2 0 00-1-1.732l-7.5-4.33z"/>
        </svg>
      {:else}
        <!-- Outline home -->
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.5 3.247a1 1 0 00-1 0L4 7.577V20h4.5v-6a1 1 0 011-1h5a1 1 0 011 1v6H20V7.577l-7.5-4.33zm-2-1.732a3 3 0 013 0l7.5 4.33a2 2 0 011 1.732V21a1 1 0 01-1 1h-6.5a1 1 0 01-1-1v-6h-3v6a1 1 0 01-1 1H3a1 1 0 01-1-1V7.577a2 2 0 011-1.732l7.5-4.33z"/>
        </svg>
      {/if}
    </button>

    <!-- Search bar -->
    <div class="search-wrapper">
      <div class="search-icon {searchFocused ? 'text-white' : 'text-[#b3b3b3]'}">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M7 1.75a5.25 5.25 0 100 10.5 5.25 5.25 0 000-10.5zM.25 7a6.75 6.75 0 1112.096 4.12l3.184 3.185a.75.75 0 11-1.06 1.06l-3.185-3.184A6.75 6.75 0 01.25 7z"/>
        </svg>
      </div>
      <input
        type="text"
        bind:value={searchQuery}
        onkeydown={handleKeyDown}
        onfocus={() => searchFocused = true}
        onblur={() => searchFocused = false}
        placeholder="What do you want to play?"
        class="search-input"
      />
      {#if searchQuery}
        <button
          class="search-clear"
          onclick={() => { searchQuery = ''; }}
          aria-label="Clear"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2.47 2.47a.75.75 0 011.06 0L8 6.94l4.47-4.47a.75.75 0 111.06 1.06L9.06 8l4.47 4.47a.75.75 0 11-1.06 1.06L8 9.06l-4.47 4.47a.75.75 0 01-1.06-1.06L6.94 8 2.47 3.53a.75.75 0 010-1.06z"/>
          </svg>
        </button>
      {/if}
    </div>
  </div>

  <!-- Right: Settings + Window controls -->
  <div class="right-section no-drag">
    <button onclick={() => goto('/settings')} class="icon-btn" aria-label="Settings" title="Settings">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 0a1.5 1.5 0 00-1.5 1.5v.21c-.57.15-1.11.38-1.6.68l-.15-.15a1.5 1.5 0 00-2.12 0L2.47 2.4a1.5 1.5 0 000 2.12l.15.15a5.5 5.5 0 00-.68 1.6H1.5a1.5 1.5 0 000 3h.44c.15.57.38 1.11.68 1.6l-.15.15a1.5 1.5 0 000 2.12l.16.16a1.5 1.5 0 002.12 0l.15-.15c.49.3 1.03.53 1.6.68v.44a1.5 1.5 0 003 0v-.44c.57-.15 1.11-.38 1.6-.68l.15.15a1.5 1.5 0 002.12 0l.16-.16a1.5 1.5 0 000-2.12l-.15-.15c.3-.49.53-1.03.68-1.6h.44a1.5 1.5 0 000-3h-.44a5.5 5.5 0 00-.68-1.6l.15-.15a1.5 1.5 0 000-2.12l-.16-.16a1.5 1.5 0 00-2.12 0l-.15.15a5.5 5.5 0 00-1.6-.68V1.5A1.5 1.5 0 008 0zm2 8a2 2 0 11-4 0 2 2 0 014 0z"/>
      </svg>
    </button>

    <div class="win-divider"></div>

    <!-- Minimize -->
    <button onclick={minimize} class="win-btn" aria-label="Minimize" title="Minimize">
      <svg width="10" height="1" viewBox="0 0 10 1">
        <rect width="10" height="1" fill="currentColor"/>
      </svg>
    </button>

    <!-- Maximize / Restore -->
    <button onclick={maximize} class="win-btn" aria-label={isMaximized ? 'Restore' : 'Maximize'} title={isMaximized ? 'Restore Down' : 'Maximize'}>
      {#if isMaximized}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1">
          <rect x="2" y="0" width="8" height="8" rx="0.5" />
          <rect x="0" y="2" width="8" height="8" rx="0.5" />
        </svg>
      {:else}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1">
          <rect x="0.5" y="0.5" width="9" height="9" rx="0.5" />
        </svg>
      {/if}
    </button>

    <!-- Close -->
    <button onclick={close} class="win-btn close-btn" aria-label="Close" title="Close">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.2">
        <line x1="0" y1="0" x2="10" y2="10" />
        <line x1="10" y1="0" x2="0" y2="10" />
      </svg>
    </button>
  </div>
</div>

<style>
  .titlebar {
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px;
    background: #000;
    user-select: none;
    flex-shrink: 0;
    gap: 8px;
  }

  .left-section {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .nav-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #b3b3b3;
    background: transparent;
  }
  .nav-btn:hover {
    color: #fff;
    background: transparent;
  }
  .nav-btn:active {
    transform: scale(0.95);
  }

  .center-section {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    max-width: 546px;
  }

  .home-btn {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #b3b3b3;
    background: rgba(255,255,255,.07);
    flex-shrink: 0;
    transition: color 0.15s, background 0.15s;
  }
  .home-btn:hover {
    color: #fff;
    background: rgba(255,255,255,.12);
  }
  .home-btn.active {
    color: #fff;
  }

  .search-wrapper {
    position: relative;
    flex: 1;
    min-width: 0;
  }

  .search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    transition: color 0.15s;
  }

  .search-input {
    width: 100%;
    height: 48px;
    padding: 0 40px 0 40px;
    background: rgba(255,255,255,.07);
    border: 2px solid transparent;
    border-radius: 500px;
    color: #fff;
    font-size: 14px;
    outline: none;
    transition: all 0.15s;
  }
  .search-input::placeholder {
    color: #7f7f7f;
  }
  .search-input:hover {
    background: rgba(255,255,255,.1);
    border-color: rgba(255,255,255,.05);
  }
  .search-input:focus {
    background: rgba(255,255,255,.12);
    border-color: rgba(255,255,255,.3);
  }

  .search-clear {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: #b3b3b3;
    padding: 4px;
    border-radius: 50%;
  }
  .search-clear:hover {
    color: #fff;
  }

  .right-section {
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }

  .icon-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #a0a0a0;
    transition: color 0.15s;
  }
  .icon-btn:hover {
    color: #fff;
    background: rgba(255,255,255,.07);
  }

  .win-divider {
    width: 1px;
    height: 16px;
    background: rgba(255,255,255,.1);
    margin: 0 8px;
  }

  .win-btn {
    width: 46px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #a0a0a0;
    border-radius: 0;
  }
  .win-btn:hover {
    color: #fff;
    background: rgba(255,255,255,.06);
  }
  .close-btn:hover {
    background: #e81123;
    color: #fff;
  }
</style>
