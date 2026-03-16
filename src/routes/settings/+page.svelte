<script lang="ts">
  import { getAuth, login, logout } from '$lib/stores/auth.svelte';
  import { goto } from '$app/navigation';
  import { resetOnboarding } from '$lib/stores/onboarding.svelte';
  import { getEqualizer, setBandGain, applyPreset, toggleEq, type PresetName } from '$lib/stores/equalizer.svelte';
  import { getSettings, setAlwaysCollapsedSidebar, setCloseToTray, setDiscordRpcEnabled, setDiscordShowListenButton, setWaveTheme, setReactiveWave, setDisableCardHover, setLyricsGlow, setLyricsFontSize, setLyricsTextAlign, setHotkey, resetHotkeys, type HotkeyBinding, type HotkeyAction } from '$lib/stores/settings.svelte';
import HotkeyInput from '$lib/components/settings/HotkeyInput.svelte';
  import { Check, Copy, AlertCircle, Music, ExternalLink, Terminal, MousePointer, Info, Link, RotateCcw, AudioLines, PanelLeftClose, MessageSquare, Palette, Settings2, MonitorDown, X, Activity } from 'lucide-svelte';
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
  let activeSection = $state<'settings' | 'connection' | 'howto' | 'about'>('settings');
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

  // Wave themes
  const waveThemes = [
    { id: 'default', name: 'Default', colors: ['#1db954', '#5028b4', '#1ed760', '#0064c8'] },
    { id: 'sunset', name: 'Sunset', colors: ['#ff6b35', '#f7c948', '#e8115b', '#ff9a56'] },
    { id: 'ocean', name: 'Ocean', colors: ['#0077b6', '#00b4d8', '#023e8a', '#48cae4'] },
    { id: 'purple', name: 'Purple', colors: ['#7b2ff7', '#c084fc', '#4c1d95', '#a855f7'] },
    { id: 'rose', name: 'Rose', colors: ['#e11d48', '#fb7185', '#9f1239', '#fda4af'] },
    { id: 'mono', name: 'Mono', colors: ['#525252', '#737373', '#404040', '#a3a3a3'] },
    { id: 'neon', name: 'Neon', colors: ['#00ff88', '#ff00ff', '#00ccff', '#ffff00'] },
    { id: 'warm', name: 'Warm', colors: ['#dc2626', '#f97316', '#b91c1c', '#fbbf24'] },
  ];

import { registerShortcut, unregisterAllShortcuts, registerAllShortcuts } from '$lib/api/hotkeys';

  // Hotkey configuration
  const hotkeyActions: { action: HotkeyAction; label: string; description: string }[] = [
    { action: 'playPause', label: 'Play/Pause', description: 'Toggle playback' },
    { action: 'nextTrack', label: 'Next Track', description: 'Skip to next track' },
    { action: 'prevTrack', label: 'Previous Track', description: 'Go to previous track' },
    { action: 'volumeUp', label: 'Volume Up', description: 'Increase volume' },
    { action: 'volumeDown', label: 'Volume Down', description: 'Decrease volume' },
    { action: 'mute', label: 'Mute', description: 'Toggle mute' },
  ];

  async function handleHotkeyChange(action: HotkeyAction, binding: HotkeyBinding) {
    await setHotkey(action, binding);
    // Register with backend
    try {
      await registerShortcut(binding);
    } catch (error) {
      console.error('Failed to register shortcut:', error);
    }
  }

  async function handleResetHotkeys() {
    await resetHotkeys();
    // Re-register all shortcuts with backend
    try {
      await unregisterAllShortcuts();
      await registerAllShortcuts(appSettings.hotkeys);
    } catch (error) {
      console.error('Failed to reset shortcuts:', error);
    }
  }
</script>

<div class="max-w-2xl mx-auto">
  <!-- Page Header -->
  <div class="mb-6">
    <h1 class="text-3xl font-bold text-white mb-2">Settings</h1>
    <p class="text-[#b3b3b3]">Manage your SoundCloud connection and preferences</p>
  </div>

  <!-- Section Nav -->
  <div class="flex gap-2 mb-6 flex-wrap">
    <button class="section-tab" class:section-tab-active={activeSection === 'settings'} onclick={() => activeSection = 'settings'}>
      <Settings2 class="w-4 h-4" />
      Global
    </button>
    <button class="section-tab" class:section-tab-active={activeSection === 'connection'} onclick={() => activeSection = 'connection'}>
      <Link class="w-4 h-4" />
      Connection
    </button>
    <button class="section-tab" class:section-tab-active={activeSection === 'howto'} onclick={() => activeSection = 'howto'}>
      <Terminal class="w-4 h-4" />
      How to get key
    </button>
    <button class="section-tab" class:section-tab-active={activeSection === 'about'} onclick={() => activeSection = 'about'}>
      <Info class="w-4 h-4" />
      About
    </button>
  </div>

  <div class="space-y-6" class:disable-hover={appSettings.disableCardHover}>
    <!-- Global Settings Section -->
    {#if activeSection === 'settings'}

    <!-- Interface -->
    <div class="settings-card">
      <h2 class="settings-section-title">Interface</h2>

      <div class="setting-row">
        <div class="setting-info">
          <PanelLeftClose class="w-5 h-5 text-[#b3b3b3] shrink-0" />
          <div>
            <p class="setting-name">Always collapse sidebar</p>
            <p class="setting-desc">Keep the sidebar in compact icon mode</p>
          </div>
        </div>
        <button
          onclick={() => setAlwaysCollapsedSidebar(!appSettings.alwaysCollapsedSidebar)}
          class="toggle {appSettings.alwaysCollapsedSidebar ? 'on' : ''}"
          aria-label="Toggle collapse sidebar"
        >
          <div class="toggle-thumb"></div>
        </button>
      </div>

      <div class="setting-divider"></div>

      <div class="setting-row">
        <div class="setting-info">
          <MonitorDown class="w-5 h-5 text-[#b3b3b3] shrink-0" />
          <div>
            <p class="setting-name">Close to system tray</p>
            <p class="setting-desc">Minimize to tray instead of quitting when you close the window</p>
          </div>
        </div>
        <button
          onclick={() => setCloseToTray(!appSettings.closeToTray)}
          class="toggle {appSettings.closeToTray ? 'on' : ''}"
          aria-label="Toggle close to tray"
        >
          <div class="toggle-thumb"></div>
        </button>
      </div>

      <div class="setting-divider"></div>

      <div class="setting-row">
        <div class="setting-info">
          <Palette class="w-5 h-5 text-[#b3b3b3] shrink-0" />
          <div>
            <p class="setting-name">Disable card hover effect</p>
            <p class="setting-desc">Don't change card background color on hover</p>
          </div>
        </div>
        <button
          onclick={() => setDisableCardHover(!appSettings.disableCardHover)}
          class="toggle {appSettings.disableCardHover ? 'on' : ''}"
          aria-label="Toggle card hover effect"
        >
          <div class="toggle-thumb"></div>
        </button>
      </div>

      <div class="setting-divider"></div>

      <div class="setting-row">
        <div class="setting-info">
          <RotateCcw class="w-5 h-5 text-[#b3b3b3] shrink-0" />
          <div>
            <p class="setting-name">Reset intro</p>
            <p class="setting-desc">Show the welcome intro again on next launch</p>
          </div>
        </div>
        <button
          onclick={handleResetIntro}
          class="setting-action-btn"
        >
          {#if introResetDone}
            <Check class="w-4 h-4 text-[#1db954]" />
            Done
          {:else}
            Reset
          {/if}
        </button>
      </div>
    </div>

    <!-- Discord -->
    <div class="settings-card">
      <h2 class="settings-section-title">Discord Rich Presence</h2>

      <div class="setting-row">
        <div class="setting-info">
          <MessageSquare class="w-5 h-5 text-[#b3b3b3] shrink-0" />
          <div>
            <p class="setting-name">Enable Discord RPC</p>
            <p class="setting-desc">Show currently playing track in Discord status</p>
          </div>
        </div>
        <button
          onclick={() => setDiscordRpcEnabled(!appSettings.discordRpcEnabled)}
          class="toggle {appSettings.discordRpcEnabled ? 'on' : ''}"
          aria-label="Toggle Discord RPC"
        >
          <div class="toggle-thumb"></div>
        </button>
      </div>

      {#if appSettings.discordRpcEnabled}
        <div class="setting-divider"></div>

        <div class="setting-row">
          <div class="setting-info">
            <ExternalLink class="w-5 h-5 text-[#b3b3b3] shrink-0" />
            <div>
              <p class="setting-name">Show "Listen on SoundCloud" button</p>
              <p class="setting-desc">Display a link button in your Discord activity</p>
            </div>
          </div>
          <button
            onclick={() => setDiscordShowListenButton(!appSettings.discordShowListenButton)}
            class="toggle {appSettings.discordShowListenButton ? 'on' : ''}"
            aria-label="Toggle listen button"
          >
            <div class="toggle-thumb"></div>
          </button>
        </div>
      {/if}
    </div>

    <!-- Equalizer -->
    <div class="settings-card">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <AudioLines class="w-5 h-5 text-[#b3b3b3]" />
          <h2 class="settings-section-title" style="margin-bottom: 0">Equalizer</h2>
        </div>
        <button
          onclick={toggleEq}
          class="toggle {eq.enabled ? 'on' : ''}"
          aria-label="Toggle equalizer"
        >
          <div class="toggle-thumb"></div>
        </button>
      </div>

      <div class="mb-4">
        <div class="flex flex-wrap gap-1.5">
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
        <div class="mt-3 flex justify-end">
          <button
            onclick={() => applyPreset('Flat')}
            class="text-sm text-[#b3b3b3] hover:text-white transition-colors"
          >
            Reset to Flat
          </button>
        </div>
      {/if}
    </div>

    <!-- Wave Theme -->
    <div class="settings-card">
      <div class="flex items-center gap-3 mb-3">
        <Palette class="w-5 h-5 text-[#b3b3b3]" />
        <h2 class="settings-section-title" style="margin-bottom: 0">Wave Theme</h2>
      </div>
      <p class="text-xs text-[#7f7f7f] mb-4">Gradient colors for Your Wave on the home page</p>

      <div class="theme-strip">
        {#each waveThemes as theme}
          <button
            class="theme-chip"
            class:active={appSettings.waveTheme === theme.id}
            onclick={() => setWaveTheme(theme.id)}
            title={theme.name}
          >
            <div
              class="theme-dot-animated"
              style="--c0: {theme.colors[0]}; --c1: {theme.colors[1]}; --c2: {theme.colors[2]}; --c3: {theme.colors[3]};"
            >
              {#if appSettings.waveTheme === theme.id}
                <Check class="w-3 h-3 text-white drop-shadow-lg" />
              {/if}
            </div>
            <span class="theme-label">{theme.name}</span>
          </button>
        {/each}
      </div>

      <div class="setting-divider"></div>

      <div class="setting-row">
        <div class="setting-info">
          <Activity class="w-5 h-5 text-[#b3b3b3] shrink-0" />
          <div>
            <p class="setting-name">Audio-reactive wave</p>
            <p class="setting-desc">Gradient reacts to the music — pulses with bass and energy</p>
          </div>
        </div>
        <button
          onclick={() => setReactiveWave(!appSettings.reactiveWave)}
          class="toggle {appSettings.reactiveWave ? 'on' : ''}"
          aria-label="Toggle reactive wave"
        >
          <div class="toggle-thumb"></div>
        </button>
      </div>
    </div>

    <!-- Lyrics Settings -->
    <div class="settings-card">
      <h2 class="settings-section-title">Lyrics</h2>

      <div class="setting-row">
        <div class="setting-info">
          <div>
            <p class="setting-name">Glow effect</p>
            <p class="setting-desc">Add subtle glow to active lyrics line</p>
          </div>
        </div>
        <button
          onclick={() => setLyricsGlow(!appSettings.lyricsGlow)}
          class="toggle {appSettings.lyricsGlow ? 'on' : ''}"
          aria-label="Toggle lyrics glow"
        >
          <div class="toggle-thumb"></div>
        </button>
      </div>

      <div class="setting-divider"></div>

      <div class="setting-row">
        <div class="setting-info">
          <div>
            <p class="setting-name">Font size</p>
            <p class="setting-desc">Adjust lyrics text size ({appSettings.lyricsFontSize}px)</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-sm text-[#b3b3b3]">20px</span>
          <input
            type="range"
            min="20"
            max="40"
            step="2"
            value={appSettings.lyricsFontSize}
            oninput={(e) => setLyricsFontSize(parseInt(e.currentTarget.value))}
            class="w-24 accent-[#1db954]"
          />
          <span class="text-sm text-[#b3b3b3]">40px</span>
        </div>
      </div>

      <div class="setting-divider"></div>

      <div class="setting-row">
        <div class="setting-info">
          <div>
            <p class="setting-name">Text alignment</p>
            <p class="setting-desc">Align lyrics text to center or left</p>
          </div>
        </div>
        <div class="flex items-center gap-1 bg-[#121212] rounded-lg p-1">
          <button
            onclick={() => setLyricsTextAlign('center')}
            class="px-3 py-1.5 rounded text-sm font-medium transition-colors {appSettings.lyricsTextAlign === 'center' ? 'bg-[#1db954] text-black' : 'text-[#b3b3b3] hover:text-white'}"
          >
            Center
          </button>
          <button
            onclick={() => setLyricsTextAlign('left')}
            class="px-3 py-1.5 rounded text-sm font-medium transition-colors {appSettings.lyricsTextAlign === 'left' ? 'bg-[#1db954] text-black' : 'text-[#b3b3b3] hover:text-white'}"
          >
            Left
          </button>
        </div>
      </div>
    </div>

    <!-- Hotkeys Settings -->
    <div class="settings-card">
      <div class="flex items-center justify-between">
        <h2 class="settings-section-title">Hotkeys</h2>
        <button
          onclick={handleResetHotkeys}
          class="text-sm text-[#b3b3b3] hover:text-white transition-colors"
        >
          Reset to defaults
        </button>
      </div>
      <p class="text-sm text-[#b3b3b3] mb-4">Global shortcuts that work even when the app is not focused</p>

      {#each hotkeyActions as { action, label, description }}
        <div class="setting-row">
          <div class="setting-info">
            <div>
              <p class="setting-name">{label}</p>
              <p class="setting-desc">{description}</p>
            </div>
          </div>
          <HotkeyInput
            action={action}
            binding={appSettings.hotkeys[action]}
            onChange={(binding) => handleHotkeyChange(action, binding)}
          />
        </div>
        {#if action !== 'mute'}
          <div class="setting-divider"></div>
        {/if}
      {/each}
    </div>

    {/if}

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
              <span class="font-bold">Note:</span> If the console says "allow pasting", type <kbd class="px-1.5 py-0.5 bg-[#282828] rounded text-xs font-mono">allow pasting</kbd> and press Enter first, then paste the script again.
            </p>
          </div>
        </div>
      {:else}
        <div class="space-y-4">
          <div class="p-4 bg-[#3d91f7]/10 border border-[#3d91f7]/20 rounded-lg">
            <p class="text-sm text-[#3d91f7] font-medium mb-1">Manual method — if the script doesn't work</p>
            <p class="text-[13px] text-[#b3b3b3]">Find the client_id yourself from network requests.</p>
          </div>

          <ol class="space-y-3 text-sm text-[#b3b3b3]">
            <li class="flex gap-3"><span class="step-num">1</span><span>Open <a href="https://soundcloud.com" target="_blank" class="text-[#1db954] hover:underline inline-flex items-center gap-1">soundcloud.com <ExternalLink class="w-3 h-3" /></a> and log in</span></li>
            <li class="flex gap-3"><span class="step-num">2</span><span>Press <kbd class="px-2 py-0.5 bg-[#282828] rounded text-xs font-mono">F12</kbd> → go to <strong class="text-white">Network</strong> tab</span></li>
            <li class="flex gap-3"><span class="step-num">3</span><span>Play any track on SoundCloud</span></li>
            <li class="flex gap-3"><span class="step-num">4</span><span>In the Network tab filter, type <kbd class="px-2 py-0.5 bg-[#282828] rounded text-xs font-mono">api-v2</kbd></span></li>
            <li class="flex gap-3"><span class="step-num">5</span><span>Click on any request → look at the URL</span></li>
            <li class="flex gap-3"><span class="step-num">6</span><span>Find <kbd class="px-2 py-0.5 bg-[#282828] rounded text-xs font-mono">client_id=XXXXXXXX</kbd> in the URL — copy that value</span></li>
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

    <!-- About Section -->
    {#if activeSection === 'about'}
    <div class="bg-[#181818] rounded-lg p-6">
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
      <p class="text-sm text-[#b3b3b3] leading-relaxed mt-4">
        A desktop SoundCloud player with a Spotify-inspired interface. Built with Svelte, Tauri, and the SoundCloud API.
      </p>
      <div class="mt-4 flex gap-3">
        <a
          href="https://github.com/aasm3535/SpotyCloud"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-2 px-4 py-2 bg-[#282828] hover:bg-[#3e3e3e] text-white text-sm font-medium rounded-full transition-colors"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          GitHub
        </a>
      </div>
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
  :global(.disable-hover) .section-tab:hover {
    color: #b3b3b3;
    background: transparent;
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

  /* Settings cards */
  .settings-card {
    background: #181818;
    border-radius: 12px;
    padding: 24px;
  }
  .settings-section-title {
    font-size: 16px;
    font-weight: 700;
    color: #fff;
    margin-bottom: 16px;
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .setting-info {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }
  .setting-name {
    font-size: 14px;
    font-weight: 500;
    color: #fff;
  }
  .setting-desc {
    font-size: 12px;
    color: #7f7f7f;
    margin-top: 1px;
  }

  .setting-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.06);
    margin: 14px 0;
  }

  /* Toggle */
  .toggle {
    position: relative;
    width: 44px;
    height: 24px;
    border-radius: 9999px;
    background: #3e3e3e;
    transition: background 0.2s;
    flex-shrink: 0;
  }
  .toggle.on {
    background: #1db954;
  }
  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.2s;
  }
  .toggle.on .toggle-thumb {
    transform: translateX(20px);
  }

  .setting-action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 16px;
    border-radius: 9999px;
    background: #282828;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    transition: background 0.15s;
    flex-shrink: 0;
  }
  .setting-action-btn:hover {
    background: #3e3e3e;
  }
  :global(.disable-hover) .setting-action-btn:hover {
    background: #282828;
  }

  /* Wave themes — compact strip */
  .theme-strip {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .theme-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 12px 5px 5px;
    border-radius: 9999px;
    background: #242424;
    border: 2px solid transparent;
    transition: all 0.15s;
    cursor: pointer;
  }
  .theme-chip:hover {
    background: #2e2e2e;
    border-color: rgba(255, 255, 255, 0.1);
  }
  :global(.disable-hover) .theme-chip:hover {
    background: #242424;
    border-color: transparent;
  }
  .theme-chip.active {
    border-color: #1db954;
    background: rgba(29, 185, 84, 0.08);
  }
  .theme-dot-animated {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle at 30% 30%, var(--c0), transparent 60%),
                radial-gradient(circle at 70% 30%, var(--c1), transparent 60%),
                radial-gradient(circle at 70% 70%, var(--c2), transparent 60%),
                radial-gradient(circle at 30% 70%, var(--c3), transparent 60%);
    position: relative;
  }
  .theme-dot-animated :global(svg) {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
  .theme-label {
    font-size: 12px;
    font-weight: 600;
    color: #b3b3b3;
    white-space: nowrap;
  }
  .theme-chip.active .theme-label {
    color: #1db954;
  }

  /* Equalizer */
  .eq-preset {
    padding: 6px 14px;
    border-radius: 50px;
    font-size: 11px;
    font-weight: 600;
    color: #b3b3b3;
    background: #282828;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }
  .eq-preset:hover { color: #fff; background: #3e3e3e; }
  .eq-preset-active { color: #000; background: #1db954; }
  .eq-preset-active:hover { background: #1ed760; color: #000; }
  :global(.disable-hover) .eq-preset:hover { color: #b3b3b3; background: #282828; }
  :global(.disable-hover) .eq-preset-active:hover { background: #1db954; color: #000; }

  .eq-bands {
    background: #0a0a0a;
    border-radius: 12px;
    padding: 16px 12px 10px;
    border: 1px solid #282828;
    transition: opacity 0.2s;
  }
  .eq-db-labels {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: #6a6a6a;
    padding: 0 4px 6px;
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
    gap: 4px;
  }
  .eq-slider-wrap {
    height: 110px;
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
    width: 110px;
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
  .eq-slider::-webkit-slider-thumb:hover { transform: scale(1.3); }
  .eq-slider:disabled { cursor: not-allowed; }
  .eq-slider:disabled::-webkit-slider-thumb { opacity: 0.5; }

  .eq-val {
    font-size: 9px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: #6a6a6a;
    text-align: center;
    line-height: 1.2;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 12px;
  }
  .eq-val-pos { color: #1db954; }
  .eq-val-neg { color: #e85d5d; }
  .eq-label {
    font-size: 9px;
    color: #6a6a6a;
    font-weight: 600;
    line-height: 1.2;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
