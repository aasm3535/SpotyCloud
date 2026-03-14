<script lang="ts">
  import { getAuth, login, logout } from '$lib/stores/auth.svelte';
  import { goto } from '$app/navigation';

  const auth = getAuth();

  let clientIdInput = $state(auth.clientId ?? '');
  let isTestingConnection = $state(false);
  let connectionStatus = $state<'idle' | 'success' | 'error'>('idle');
  let errorMessage = $state('');

  async function handleSave() {
    if (!clientIdInput.trim()) return;

    isTestingConnection = true;
    connectionStatus = 'idle';
    errorMessage = '';

    try {
      const ok = await login(clientIdInput.trim());
      if (ok) {
        connectionStatus = 'success';
        setTimeout(() => goto('/'), 1000);
      } else {
        connectionStatus = 'error';
        errorMessage = 'Invalid client_id — could not connect to SoundCloud API';
      }
    } catch (e) {
      connectionStatus = 'error';
      errorMessage = e instanceof Error ? e.message : 'Connection failed';
    } finally {
      isTestingConnection = false;
    }
  }

  function handleLogout() {
    logout();
    clientIdInput = '';
    connectionStatus = 'idle';
  }
</script>

<div class="max-w-lg">
  <h1 class="text-2xl font-bold mb-6">Settings</h1>

  <div class="space-y-6">
    <!-- Auth section -->
    <div class="p-5 bg-bg-secondary rounded-lg border border-border">
      <h2 class="text-base font-medium mb-4">SoundCloud Connection</h2>

      {#if auth.isAuthenticated}
        <div class="flex items-center gap-2 mb-4">
          <div class="w-2 h-2 rounded-full bg-green-500"></div>
          <span class="text-sm text-green-400">Connected</span>
        </div>
      {/if}

      <label class="block mb-2">
        <span class="text-sm text-text-secondary">Client ID</span>
        <input
          type="text"
          bind:value={clientIdInput}
          placeholder="Paste your SoundCloud client_id..."
          class="mt-1 w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors"
        />
      </label>

      <div class="flex gap-2 mt-3">
        <button
          onclick={handleSave}
          disabled={isTestingConnection || !clientIdInput.trim()}
          class="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isTestingConnection ? 'Testing...' : 'Test & Save'}
        </button>

        {#if auth.isAuthenticated}
          <button
            onclick={handleLogout}
            class="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Disconnect
          </button>
        {/if}
      </div>

      {#if connectionStatus === 'success'}
        <p class="mt-3 text-sm text-green-400">Connected successfully! Redirecting...</p>
      {:else if connectionStatus === 'error'}
        <p class="mt-3 text-sm text-red-400">{errorMessage}</p>
      {/if}
    </div>

    <!-- Instructions -->
    <div class="p-5 bg-bg-secondary rounded-lg border border-border">
      <h2 class="text-base font-medium mb-3">How to get your Client ID</h2>
      <ol class="space-y-2 text-sm text-text-secondary list-decimal list-inside">
        <li>Open <span class="text-accent">soundcloud.com</span> in your browser</li>
        <li>Press <kbd class="px-1.5 py-0.5 bg-bg-tertiary rounded text-xs font-mono">F12</kbd> to open DevTools</li>
        <li>Go to the <strong class="text-text-primary">Network</strong> tab</li>
        <li>Play any track or navigate the site</li>
        <li>Filter requests by <span class="text-accent font-mono text-xs">api-v2</span></li>
        <li>Find a request with <span class="text-accent font-mono text-xs">client_id=</span> in the URL</li>
        <li>Copy the 32-character string after <span class="font-mono text-xs">client_id=</span></li>
      </ol>
    </div>
  </div>
</div>
