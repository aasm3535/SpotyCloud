<script lang="ts">
  import { completeOnboarding } from '$lib/stores/onboarding.svelte';
  import { login, getAuth } from '$lib/stores/auth.svelte';
  import { goto } from '$app/navigation';
  import { Search, Heart, ListMusic, Music, ArrowRight, ArrowLeft, Check, Copy, AlertCircle, Terminal, MousePointer, ExternalLink, KeyRound, Plug } from 'lucide-svelte';

  const auth = getAuth();
  let currentStep = $state(0);
  const totalSteps = 3;

  let clientIdInput = $state('');
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

  async function handleConnect() {
    if (!clientIdInput.trim()) return;
    isTestingConnection = true;
    connectionStatus = 'idle';
    errorMessage = '';
    try {
      const result = await login(clientIdInput.trim());
      if (result.success) {
        connectionStatus = 'success';
      } else {
        connectionStatus = 'error';
        errorMessage = result.error || 'Invalid client_id';
      }
    } catch (e) {
      connectionStatus = 'error';
      errorMessage = e instanceof Error ? e.message : 'Connection failed';
    } finally {
      isTestingConnection = false;
    }
  }

  function finish() {
    completeOnboarding();
    if (auth.isAuthenticated) goto('/');
  }

  function next() {
    if (currentStep < totalSteps - 1) currentStep++;
    else finish();
  }

  function prev() {
    if (currentStep > 0) currentStep--;
  }
</script>

<div class="max-w-2xl mx-auto">
  <!-- Header -->
  <div class="mb-6">
    <h1 class="text-3xl font-bold text-white mb-2">
      {#if currentStep === 0}Welcome{:else if currentStep === 1}Setup{:else}Connect{/if}
    </h1>
    <p class="text-[#b3b3b3]">
      {#if currentStep === 0}Get started with SpotyCloud{:else if currentStep === 1}Get your SoundCloud Client ID{:else}Connect your account{/if}
    </p>
  </div>

  <!-- Step tabs -->
  <div class="flex gap-2 mb-6">
    <button class="section-tab" class:section-tab-active={currentStep === 0} onclick={() => currentStep = 0}>
      <Music class="w-4 h-4" />
      Welcome
    </button>
    <button class="section-tab" class:section-tab-active={currentStep === 1} onclick={() => currentStep = 1}>
      <KeyRound class="w-4 h-4" />
      Get Key
    </button>
    <button class="section-tab" class:section-tab-active={currentStep === 2} onclick={() => currentStep = 2}>
      <Plug class="w-4 h-4" />
      Connect
    </button>
  </div>

  <div class="space-y-6">
    <!-- Step 0: Welcome -->
    {#if currentStep === 0}
    <div class="bg-[#181818] rounded-lg p-6">
      <div class="flex items-center gap-4 mb-6">
        <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-[#1db954] to-[#1ed760] flex items-center justify-center shadow-lg">
          <svg class="w-8 h-8 text-black" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z"/>
          </svg>
        </div>
        <div>
          <p class="text-white font-bold text-lg">SpotyCloud</p>
          <p class="text-[#b3b3b3] text-sm">Your desktop SoundCloud player</p>
        </div>
      </div>
      <p class="text-sm text-[#b3b3b3] leading-relaxed mb-6">
        Stream millions of tracks, create playlists, and enjoy music — all from your desktop. To get started, you'll need to connect a SoundCloud Client ID.
      </p>
      <div class="grid grid-cols-2 gap-3">
        <div class="flex items-center gap-3 p-3 bg-[#282828]/50 rounded-lg">
          <Search class="w-5 h-5 text-[#1db954] shrink-0" />
          <span class="text-sm text-[#e0e0e0]">Search tracks</span>
        </div>
        <div class="flex items-center gap-3 p-3 bg-[#282828]/50 rounded-lg">
          <Heart class="w-5 h-5 text-[#1db954] shrink-0" />
          <span class="text-sm text-[#e0e0e0]">Like songs</span>
        </div>
        <div class="flex items-center gap-3 p-3 bg-[#282828]/50 rounded-lg">
          <ListMusic class="w-5 h-5 text-[#1db954] shrink-0" />
          <span class="text-sm text-[#e0e0e0]">Create playlists</span>
        </div>
        <div class="flex items-center gap-3 p-3 bg-[#282828]/50 rounded-lg">
          <Music class="w-5 h-5 text-[#1db954] shrink-0" />
          <span class="text-sm text-[#e0e0e0]">Stream music</span>
        </div>
      </div>
    </div>
    {/if}

    <!-- Step 1: Get Key -->
    {#if currentStep === 1}
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
        <div class="space-y-4">
          <ol class="space-y-3 text-sm text-[#b3b3b3]">
            <li class="flex gap-3">
              <span class="step-num">1</span>
              <span>Open <a href="https://soundcloud.com" target="_blank" class="text-[#1db954] hover:underline inline-flex items-center gap-1">soundcloud.com <ExternalLink class="w-3 h-3" /></a></span>
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

          <div class="relative">
            <pre class="p-4 bg-[#0a0a0a] rounded-lg overflow-x-auto text-xs font-mono text-[#b3b3b3] leading-relaxed border border-[#282828] max-h-24 overflow-y-auto">{extractScript}</pre>
            <button
              onclick={copyScript}
              class="absolute top-2 right-2 text-sm px-3 py-1.5 bg-[#282828] hover:bg-[#3e3e3e] text-white rounded-lg transition-colors flex items-center gap-1.5"
            >
              {#if copiedScript}
                <Check class="w-3.5 h-3.5" /> Copied!
              {:else}
                <Copy class="w-3.5 h-3.5" /> Copy
              {/if}
            </button>
          </div>

          <div class="p-3 bg-[#ffa42b]/10 border border-[#ffa42b]/20 rounded-lg">
            <p class="text-[13px] text-[#ffa42b]">
              <span class="font-bold">Note:</span> If the console says "allow pasting", type <kbd class="px-1.5 py-0.5 bg-[#282828] rounded text-xs font-mono">allow pasting</kbd> and press Enter first.
            </p>
          </div>
        </div>
      {:else}
        <div class="space-y-4">
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
              <span>Find <kbd class="px-2 py-0.5 bg-[#282828] rounded text-xs font-mono">client_id=XXXXXXXX</kbd> in the URL</span>
            </li>
          </ol>

          <div class="p-3 bg-white/5 rounded-lg">
            <p class="text-xs font-mono text-[#b3b3b3] break-all">
              Example: https://api-v2.soundcloud.com/tracks?client_id=<span class="text-[#1db954] font-bold">aBcDeFgHiJkLmNoPqRsTuVwXyZ012345</span>&...
            </p>
          </div>
        </div>
      {/if}
    </div>
    {/if}

    <!-- Step 2: Connect -->
    {#if currentStep === 2}
    <div class="bg-[#181818] rounded-lg p-6">
      <div class="flex items-center gap-4 mb-6">
        <div class="w-12 h-12 rounded-full bg-[#282828] flex items-center justify-center">
          <Plug class="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 class="text-lg font-bold text-white">SoundCloud Connection</h2>
          {#if connectionStatus === 'success'}
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-[#1db954]"></div>
              <span class="text-sm text-[#1db954] font-medium">Connected</span>
            </div>
          {:else}
            <p class="text-sm text-[#b3b3b3]">Paste your Client ID to start streaming</p>
          {/if}
        </div>
      </div>

      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-white mb-2" for="ob-client-id">Client ID</label>
          <input
            id="ob-client-id"
            type="text"
            bind:value={clientIdInput}
            placeholder="Paste your SoundCloud client_id..."
            disabled={connectionStatus === 'success'}
            class="w-full h-12 px-4 bg-[#121212] border border-[#282828] rounded-lg text-white placeholder:text-[#6a6a6a] focus:outline-none focus:border-white/30 transition-colors disabled:opacity-50"
          />
        </div>

        {#if connectionStatus !== 'success'}
          <button
            onclick={handleConnect}
            disabled={isTestingConnection || !clientIdInput.trim()}
            class="h-12 px-8 bg-[#1db954] hover:bg-[#1ed760] text-black font-bold rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTestingConnection ? 'Connecting...' : 'Connect'}
          </button>
        {/if}

        {#if connectionStatus === 'error'}
          <div class="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div class="flex items-start gap-3">
              <AlertCircle class="w-5 h-5 text-red-400 mt-0.5" />
              <div>
                <p class="text-sm text-red-400 font-medium">Connection failed</p>
                <p class="text-sm text-red-400/80 mt-1">{errorMessage}</p>
              </div>
            </div>
          </div>
        {/if}

        {#if connectionStatus === 'success'}
          <div class="p-4 bg-[#1db954]/10 border border-[#1db954]/20 rounded-lg">
            <div class="flex items-center gap-3">
              <Check class="w-5 h-5 text-[#1db954]" />
              <p class="text-sm text-[#1db954] font-medium">Connected! Click "Start Listening" to begin.</p>
            </div>
          </div>
        {/if}
      </div>
    </div>

    {#if connectionStatus !== 'success'}
    <div class="bg-[#181818] rounded-lg p-6">
      <p class="text-sm text-[#b3b3b3]">Don't have a Client ID yet? Go back to the <button class="text-[#1db954] hover:underline font-medium" onclick={() => currentStep = 1}>Get Key</button> step for instructions.</p>
    </div>
    {/if}
    {/if}

    <!-- Navigation -->
    <div class="flex items-center justify-between pt-2">
      {#if currentStep > 0}
        <button
          onclick={prev}
          class="flex items-center gap-2 h-10 px-5 text-[#b3b3b3] hover:text-white font-medium rounded-full hover:bg-white/10 transition-colors text-sm"
        >
          <ArrowLeft class="w-4 h-4" /> Back
        </button>
      {:else}
        <div></div>
      {/if}

      <div class="flex items-center gap-3">
        {#if currentStep < totalSteps - 1}
          <button
            onclick={finish}
            class="h-10 px-5 text-[#6a6a6a] hover:text-[#b3b3b3] font-medium text-sm transition-colors"
          >
            Skip
          </button>
        {/if}
        <button
          onclick={next}
          class="flex items-center gap-2 h-10 px-6 bg-white hover:bg-[#e0e0e0] text-black font-bold rounded-full transition-colors text-sm"
        >
          {#if currentStep === totalSteps - 1}
            {connectionStatus === 'success' ? 'Start Listening' : 'Finish Setup'}
          {:else}
            Next
          {/if}
          <ArrowRight class="w-4 h-4" />
        </button>
      </div>
    </div>
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
</style>
