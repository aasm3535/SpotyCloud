<script lang="ts">
  import { getAuth, login, logout } from '$lib/stores/auth.svelte';
  import { goto } from '$app/navigation';
  import { resetOnboarding } from '$lib/stores/onboarding.svelte';
  import { getEqualizer, setBandGain, applyPreset, toggleEq, type PresetName } from '$lib/stores/equalizer.svelte';
  import { getSettings, setAlwaysCollapsedSidebar } from '$lib/stores/settings.svelte';
  import { Check, Copy, AlertCircle, Music, ExternalLink, Terminal, MousePointer, Info, Link, RotateCcw, AudioLines, PanelLeftClose } from 'lucide-svelte';
  import { onMount } from 'svelte';

  const auth = getAuth();
  let appVersion = $state('...');

  onMount(async () => {
    try {
      const { getVersion } = await import('@tauri-apps/api/app');
      appVersion = await getVersion();
    } catch { appVersion = '?'; }
  });
  const eq = getEqualizer();
  const appSettings = getSettings();
  let activeSection = $state<'connection' | 'howto' | 'equalizer' | 'about'>('connection');
  let introResetDone = $state(false);

  function handleResetIntro() {
    resetOnboarding();
    introResetDone = true;
    setTimeout(() => introResetDone = false, 2000);
  }

  let clientIdInput = $state(auth.clientId ?? '');
  let isTestingConnection = $state(false);
  let connectionStatus = $state<'idle' | 'success' | 'error'>('idle');
  let errorMessage = $state('');
  let copiedScript = $state(false);
  let activeTab = $state<'script' | 'manual'>('script');

  const extractScript = `// Paste in Console on soundcloud.com (F12 > Console)
(function(){
  var e = performance.getEntriesByType("resource");
  for (var i = 0; i < e.length; i++) {
    var m = e[i].name.match(/client_id=([a-zA-Z0-9]{20,})/);
    if (m) {
      copy(m[1]);
      console.log("%c" + m[1], "color:#1db954;font-size:20px;font-weight:bold");
      console.log("%cCopied to clipboard!", "color:#1db954;font-size:14px");
      return;
    }
  }
  console.log("%cNot found. Reload the page and try again.", "color:red;font-size:14px");
})()`;

  function copyScript() {
    navigator.clipboard.writeText(extractScript.trim());
    copiedScript = true;
    setTimeout(() => copiedScript = false, 2000);
  }

  async function handleSave() {
    if (!clientIdInput.trim()) return;

    isTestingConnection = true;
    connectionStatus = 'idle';
    errorMessage = '';

    try {
      const result = await login(clientIdInput.trim());
      if (result.success) {
        connectionStatus = 'success';
        setTimeout(() => goto('/'), 1000);
      } else {
        connectionStatus = 'error';
        errorMessage = result.error || 'Invalid client_id — could not connect to SoundCloud API';
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

<div class="max-w-2xl mx-auto">
  <!-- Page Header -->
  <div class="mb-6">
    <h1 class="text-3xl font-bold text-white mb-2">Settings</h1>
    <p class="text-[#b3b3b3]">Manage your SoundCloud connection and preferences</p>
  </div>

  <!-- Section Nav -->
  <div class="flex gap-2 mb-6">
    <button class="section-tab" class:section-tab-active={activeSection === 'connection'} onclick={() => activeSection = 'connection'}>
      <Link class="w-4 h-4" />
      Connection
    </button>
    <button class="section-tab" class:section-tab-active={activeSection === 'howto'} onclick={() => activeSection = 'howto'}>
      <Terminal class="w-4 h-4" />
      How to get key
    </button>
    <button class="section-tab" class:section-tab-active={activeSection === 'equalizer'} onclick={() => activeSection = 'equalizer'}>
      <AudioLines class="w-4 h-4" />
      Equalizer
    </button>
    <button class="section-tab" class:section-tab-active={activeSection === 'about'} onclick={() => activeSection = 'about'}>
      <Info class="w-4 h-4" />
      About
    </button>
  </div>

  <div class="space-y-6">
    <!-- Connection Section -->
    {#if activeSection === 'connection'}
    <div class="bg-[#181818] rounded-lg p-6">
      <div class="flex items-center gap-4 mb-6">
        <div class="w-12 h-12 rounded-full bg-[#282828] flex items-center justify-center">
          <Music class="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 class="text-lg font-bold text-white">SoundCloud Connection</h2>
          {#if auth.isAuthenticated}
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-[#1db954]"></div>
              <span class="text-sm text-[#1db954] font-medium">Connected</span>
            </div>
          {:else}
            <p class="text-sm text-[#b3b3b3]">Not connected</p>
          {/if}
        </div>
      </div>

      <!-- Client ID Input -->
      <div class="space-y-4">
        <div class="relative">
          <label class="block text-sm font-medium text-white mb-2" for="client-id-input">Client ID</label>
          <input
            id="client-id-input"
            type="text"
            bind:value={clientIdInput}
            placeholder="Paste your SoundCloud client_id..."
            disabled={auth.isAuthenticated}
            class="w-full h-12 px-4 bg-[#121212] border border-[#282828] rounded-lg text-white placeholder:text-[#6a6a6a] focus:outline-none focus:border-white/30 transition-colors disabled:opacity-50"
          />
        </div>

        <div class="flex gap-3">
          {#if !auth.isAuthenticated}
            <button
              onclick={handleSave}
              disabled={isTestingConnection || !clientIdInput.trim()}
              class="h-12 px-8 bg-[#1db954] hover:bg-[#1ed760] text-black font-bold rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTestingConnection ? 'Connecting...' : 'Connect'}
            </button>
          {:else}
            <button
              onclick={handleLogout}
              class="h-12 px-8 bg-transparent hover:bg-white/10 text-white font-bold rounded-full border border-white/30 transition-colors"
            >
              Disconnect
            </button>
          {/if}
        </div>

        {#if connectionStatus === 'error'}
          <div class="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div class="flex items-start gap-3">
              <AlertCircle class="w-5 h-5 text-red-400 mt-0.5" />
              <div>
                <p class="text-sm text-red-400 font-medium">Connection failed</p>
                <p class="text-sm text-red-400/80 mt-1">{errorMessage}</p>
                <div class="mt-3 text-sm text-[#b3b3b3]">
                  <p class="font-medium mb-1">Make sure:</p>
                  <ul class="list-disc list-inside space-y-0.5">
                    <li>You're logged into SoundCloud in your browser</li>
                    <li>You copied the full 32-character client_id</li>
                    <li>You played at least one track before extracting</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        {/if}

        {#if connectionStatus === 'success'}
          <div class="mt-4 p-4 bg-[#1db954]/10 border border-[#1db954]/20 rounded-lg">
            <div class="flex items-center gap-3">
              <Check class="w-5 h-5 text-[#1db954]" />
              <p class="text-sm text-[#1db954] font-medium">Connected successfully! Redirecting...</p>
            </div>
          </div>
        {/if}
      </div>
    </div>

    {/if}

    <!-- How to get key Section -->
    {#if activeSection === 'howto'}
    <div class="bg-[#181818] rounded-lg p-6">
      <h2 class="text-lg font-bold text-white mb-4">How to get your Client ID</h2>

      <!-- Method Tabs -->
      <div class="flex gap-1 mb-6 bg-[#0a0a0a] rounded-lg p-1">
        <button
          onclick={() => activeTab = 'script'}
          class="method-tab" class:method-tab-active={activeTab === 'script'}
        >
          <Terminal class="w-4 h-4" />
          Script (Easy)
        </button>
        <button
          onclick={() => activeTab = 'manual'}
          class="method-tab" class:method-tab-active={activeTab === 'manual'}
        >
          <MousePointer class="w-4 h-4" />
          Manual
        </button>
      </div>

      {#if activeTab === 'script'}
        <!-- Script Method -->
        <div class="space-y-4">
          <div class="p-4 bg-[#1db954]/10 border border-[#1db954]/20 rounded-lg">
            <p class="text-sm text-[#1db954] font-medium mb-1">Fastest method — 3 steps</p>
            <p class="text-[13px] text-[#b3b3b3]">Copy a script, paste it in your browser console, and get your key instantly.</p>
          </div>

          <ol class="space-y-3 text-sm text-[#b3b3b3]">
            <li class="flex gap-3">
              <span class="step-num">1</span>
              <span>Open <a href="https://soundcloud.com" target="_blank" class="text-[#1db954] hover:underline inline-flex items-center gap-1">soundcloud.com <ExternalLink class="w-3 h-3" /></a> in your browser</span>
            </li>
            <li class="flex gap-3">
              <span class="step-num">2</span>
              <span>Press <kbd class="px-2 py-0.5 bg-[#282828] rounded text-xs font-mono">F12</kbd> → go to <strong class="text-white">Console</strong> tab</span>
            </li>
            <li class="flex gap-3">
              <span class="step-num">3</span>
              <span>Paste the script below and press <kbd class="px-2 py-0.5 bg-[#282828] rounded text-xs font-mono">Enter</kbd></span>
            </li>
          </ol>

          <div class="space-y-2">
            <div class="relative">
              <pre class="p-4 bg-[#0a0a0a] rounded-lg overflow-x-auto text-xs font-mono text-[#b3b3b3] leading-relaxed border border-[#282828] max-h-24 overflow-y-auto">{extractScript}</pre>
              <button
                onclick={copyScript}
                class="absolute top-2 right-2 text-sm px-3 py-1.5 bg-[#282828] hover:bg-[#3e3e3e] text-white rounded-lg transition-colors flex items-center gap-1.5"
              >
                {#if copiedScript}
                  <Check class="w-3.5 h-3.5" />
                  Copied!
                {:else}
                  <Copy class="w-3.5 h-3.5" />
                  Copy
                {/if}
              </button>
            </div>
          </div>

          <div class="p-3 bg-[#ffa42b]/10 border border-[#ffa42b]/20 rounded-lg">
            <p class="text-[13px] text-[#ffa42b]">
              <span class="font-bold">Note:</span> If the console says "allow pasting", type <kbd class="px-1.5 py-0.5 bg-[#282828] rounded text-xs font-mono">allow pasting</kbd> and press Enter first, then paste the script again.
            </p>
          </div>
        </div>
      {:else}
        <!-- Manual Method -->
        <div class="space-y-4">
          <div class="p-4 bg-[#3d91f7]/10 border border-[#3d91f7]/20 rounded-lg">
            <p class="text-sm text-[#3d91f7] font-medium mb-1">Manual method — if the script doesn't work</p>
            <p class="text-[13px] text-[#b3b3b3]">Find the client_id yourself from network requests.</p>
          </div>

          <ol class="space-y-3 text-sm text-[#b3b3b3]">
            <li class="flex gap-3">
              <span class="step-num">1</span>
              <span>Open <a href="https://soundcloud.com" target="_blank" class="text-[#1db954] hover:underline inline-flex items-center gap-1">soundcloud.com <ExternalLink class="w-3 h-3" /></a> and log in</span>
            </li>
            <li class="flex gap-3">
              <span class="step-num">2</span>
              <span>Press <kbd class="px-2 py-0.5 bg-[#282828] rounded text-xs font-mono">F12</kbd> → go to <strong class="text-white">Network</strong> tab</span>
            </li>
            <li class="flex gap-3">
              <span class="step-num">3</span>
              <span>Play any track on SoundCloud</span>
            </li>
            <li class="flex gap-3">
              <span class="step-num">4</span>
              <span>In the Network tab filter, type <kbd class="px-2 py-0.5 bg-[#282828] rounded text-xs font-mono">api-v2</kbd></span>
            </li>
            <li class="flex gap-3">
              <span class="step-num">5</span>
              <span>Click on any request → look at the URL</span>
            </li>
            <li class="flex gap-3">
              <span class="step-num">6</span>
              <span>Find <kbd class="px-2 py-0.5 bg-[#282828] rounded text-xs font-mono">client_id=XXXXXXXX</kbd> in the URL — copy that value</span>
            </li>
          </ol>

          <div class="p-3 bg-white/5 rounded-lg">
            <p class="text-xs font-mono text-[#b3b3b3] break-all">
              Example URL: https://api-v2.soundcloud.com/tracks?client_id=<span class="text-[#1db954] font-bold">aBcDeFgHiJkLmNoPqRsTuVwXyZ012345</span>&...
            </p>
          </div>

          <div class="p-3 bg-[#ffa42b]/10 border border-[#ffa42b]/20 rounded-lg">
            <p class="text-[13px] text-[#ffa42b]">
              <span class="font-bold">Tip:</span> The client_id is a 32-character alphanumeric string. It looks something like <code class="text-white/80">a1b2c3d4e5f6g7h8i9j0...</code>
            </p>
          </div>
        </div>
      {/if}
    </div>
    {/if}

    <!-- Equalizer Section -->
    {#if activeSection === 'equalizer'}
    <div class="bg-[#181818] rounded-lg p-6">
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-full bg-[#282828] flex items-center justify-center">
            <AudioLines class="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 class="text-lg font-bold text-white">Equalizer</h2>
            <p class="text-sm text-[#b3b3b3]">Adjust audio frequency bands</p>
          </div>
        </div>
        <button
          onclick={toggleEq}
          class="relative w-11 h-6 rounded-full transition-colors {eq.enabled ? 'bg-[#1db954]' : 'bg-[#3e3e3e]'}"
        >
          <div class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform {eq.enabled ? 'translate-x-5' : 'translate-x-0'}"></div>
        </button>
      </div>

      <!-- Presets -->
      <div class="mb-6">
        <p class="text-xs font-semibold text-[#b3b3b3] uppercase tracking-wider mb-3">Presets</p>
        <div class="flex flex-wrap gap-2">
          {#each eq.presetNames as name}
            <button
              onclick={() => applyPreset(name)}
              class="eq-preset"
              class:eq-preset-active={eq.activePreset === name}
            >
              {name}
            </button>
          {/each}
        </div>
      </div>

      <!-- Bands -->
      <div class="eq-bands" class:opacity-40={!eq.enabled}>
        <div class="eq-db-labels">
          <span>+12</span>
          <span>0</span>
          <span>-12</span>
        </div>
        <div class="eq-columns">
          {#each eq.bands as band, i}
            <div class="eq-band">
              <div class="eq-slider-wrap">
                <div class="eq-track-bg">
                  <div class="eq-zero-line"></div>
                </div>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="0.5"
                  value={eq.gains[i]}
                  oninput={(e) => setBandGain(i, parseFloat(e.currentTarget.value))}
                  disabled={!eq.enabled}
                  class="eq-slider"
                />
              </div>
              <span class="eq-val" class:eq-val-pos={eq.gains[i] > 0} class:eq-val-neg={eq.gains[i] < 0}>
                {eq.gains[i] > 0 ? '+' : ''}{eq.gains[i].toFixed(1)}
              </span>
              <span class="eq-label">{band.label}</span>
            </div>
          {/each}
        </div>
      </div>

      {#if eq.activePreset === 'Custom'}
        <div class="mt-4 flex justify-end">
          <button
            onclick={() => applyPreset('Flat')}
            class="text-sm text-[#b3b3b3] hover:text-white transition-colors"
          >
            Reset to Flat
          </button>
        </div>
      {/if}
    </div>
    {/if}

    <!-- About Section -->
    {#if activeSection === 'about'}
    <div class="bg-[#181818] rounded-lg p-6">
      <h2 class="text-lg font-bold text-white mb-4">About SpotyCloud</h2>
      <div class="space-y-4">
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-[#1db954] to-[#1ed760] flex items-center justify-center shadow-lg">
            <svg class="w-8 h-8 text-black" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z"/>
            </svg>
          </div>
          <div>
            <p class="text-white font-bold text-lg">SpotyCloud</p>
            <p class="text-[#b3b3b3] text-sm">Version {appVersion}</p>
          </div>
        </div>
        <p class="text-sm text-[#b3b3b3] leading-relaxed">
          A desktop SoundCloud player with a Spotify-inspired interface. Built with Svelte, Tauri, and the SoundCloud API.
        </p>
      </div>
    </div>

    <div class="bg-[#181818] rounded-lg p-6">
      <h2 class="text-lg font-bold text-white mb-4">Interface</h2>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <PanelLeftClose class="w-5 h-5 text-[#b3b3b3]" />
          <div>
            <p class="text-sm font-medium text-white">Always collapse sidebar</p>
            <p class="text-xs text-[#b3b3b3]">Keep the sidebar in compact mode</p>
          </div>
        </div>
        <button
          onclick={() => setAlwaysCollapsedSidebar(!appSettings.alwaysCollapsedSidebar)}
          class="relative w-11 h-6 rounded-full transition-colors {appSettings.alwaysCollapsedSidebar ? 'bg-[#1db954]' : 'bg-[#3e3e3e]'}"
        >
          <div class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform {appSettings.alwaysCollapsedSidebar ? 'translate-x-5' : 'translate-x-0'}"></div>
        </button>
      </div>
    </div>

    <div class="bg-[#181818] rounded-lg p-6">
      <h2 class="text-lg font-bold text-white mb-4">Intro</h2>
      <p class="text-sm text-[#b3b3b3] mb-4">Show the welcome intro again on next launch.</p>
      <button
        onclick={handleResetIntro}
        class="flex items-center gap-2 px-5 py-2.5 bg-[#282828] hover:bg-[#3e3e3e] text-white font-medium rounded-full text-sm transition-colors"
      >
        {#if introResetDone}
          <Check class="w-4 h-4 text-[#1db954]" />
          Intro will show on next launch
        {:else}
          <RotateCcw class="w-4 h-4" />
          Reset intro
        {/if}
      </button>
    </div>
    {/if}
  </div>
</div>

<style>
  .section-tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 50px;
    font-size: 13px;
    font-weight: 600;
    color: #b3b3b3;
    background: transparent;
    transition: color 0.2s, background 0.2s;
  }
  .section-tab:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.07);
  }
  .section-tab-active {
    color: #000;
    background: #fff;
  }
  .section-tab-active:hover {
    color: #000;
    background: #e0e0e0;
  }
  .method-tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    color: #6a6a6a;
    transition: color 0.2s, background 0.2s;
  }
  .method-tab:hover {
    color: #b3b3b3;
  }
  .method-tab-active {
    background: #282828;
    color: #fff;
  }
  .step-num {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #282828;
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    flex-shrink: 0;
  }

  /* Equalizer */
  .eq-preset {
    padding: 6px 14px;
    border-radius: 50px;
    font-size: 12px;
    font-weight: 600;
    color: #b3b3b3;
    background: #282828;
    transition: all 0.15s;
  }
  .eq-preset:hover {
    color: #fff;
    background: #3e3e3e;
  }
  .eq-preset-active {
    color: #000;
    background: #1db954;
  }
  .eq-preset-active:hover {
    background: #1ed760;
    color: #000;
  }

  .eq-bands {
    background: #0a0a0a;
    border-radius: 12px;
    padding: 20px 16px 12px;
    border: 1px solid #282828;
    transition: opacity 0.2s;
  }

  .eq-db-labels {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: #6a6a6a;
    padding: 0 4px 8px;
  }

  .eq-columns {
    display: grid;
    grid-template-columns: repeat(10, 1fr);
    gap: 2px;
  }

  .eq-band {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .eq-slider-wrap {
    height: 130px;
    width: 28px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .eq-track-bg {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .eq-track-bg::before {
    content: '';
    position: absolute;
    width: 3px;
    height: 100%;
    background: #2a2a2a;
    border-radius: 2px;
  }
  .eq-zero-line {
    position: absolute;
    width: 12px;
    height: 1px;
    background: #3e3e3e;
    top: 50%;
  }

  .eq-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 130px;
    height: 28px;
    background: transparent;
    cursor: pointer;
    transform: rotate(-90deg);
    transform-origin: center;
    margin: 0;
    padding: 0;
  }
  .eq-slider::-webkit-slider-runnable-track {
    width: 100%;
    height: 3px;
    background: transparent;
    border-radius: 2px;
  }
  .eq-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    cursor: pointer;
    margin-top: -6px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
    transition: transform 0.1s;
  }
  .eq-slider::-webkit-slider-thumb:hover {
    transform: scale(1.3);
  }
  .eq-slider:disabled {
    cursor: not-allowed;
  }
  .eq-slider:disabled::-webkit-slider-thumb {
    opacity: 0.5;
  }

  .eq-val {
    font-size: 10px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: #6a6a6a;
    text-align: center;
    line-height: 1;
  }
  .eq-val-pos { color: #1db954; }
  .eq-val-neg { color: #e85d5d; }

  .eq-label {
    font-size: 10px;
    color: #6a6a6a;
    font-weight: 600;
    line-height: 1;
  }
</style>
