<script lang="ts">
  import { check } from '@tauri-apps/plugin-updater';
  import { relaunch } from '@tauri-apps/plugin-process';
  import { onMount } from 'svelte';
  import { X, Download, RefreshCw } from 'lucide-svelte';

  let updateAvailable = $state(false);
  let updateVersion = $state('');
  let updateBody = $state('');
  let isDownloading = $state(false);
  let downloadProgress = $state(0);
  let isInstalling = $state(false);
  let dismissed = $state(false);
  let updateObj: Awaited<ReturnType<typeof check>> = null;

  onMount(() => {
    // Check for updates after 3 seconds
    setTimeout(() => checkForUpdate(), 3000);
    // Then check every 30 minutes
    const interval = setInterval(() => checkForUpdate(), 30 * 60 * 1000);
    return () => clearInterval(interval);
  });

  async function checkForUpdate() {
    try {
      const update = await check();
      if (update) {
        updateObj = update;
        updateVersion = update.version;
        updateBody = update.body || '';
        updateAvailable = true;
        dismissed = false;
        console.log('[Updater] Update available:', update.version);
      }
    } catch (e) {
      console.warn('[Updater] Check failed:', e);
    }
  }

  async function downloadAndInstall() {
    if (!updateObj || isDownloading) return;
    isDownloading = true;
    downloadProgress = 0;

    try {
      let totalSize = 0;
      let downloaded = 0;

      await updateObj.downloadAndInstall((event) => {
        if (event.event === 'Started' && event.data.contentLength) {
          totalSize = event.data.contentLength;
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          if (totalSize > 0) {
            downloadProgress = Math.round((downloaded / totalSize) * 100);
          }
        } else if (event.event === 'Finished') {
          isDownloading = false;
          isInstalling = true;
        }
      });

      // Relaunch after install
      await relaunch();
    } catch (e) {
      console.error('[Updater] Install failed:', e);
      isDownloading = false;
      isInstalling = false;
    }
  }
</script>

{#if updateAvailable && !dismissed}
  <div class="update-banner">
    <div class="update-content">
      <div class="update-icon">
        <Download class="w-4 h-4" />
      </div>
      <div class="update-text">
        {#if isInstalling}
          <span class="font-semibold">Installing update...</span>
          <span class="text-xs text-[#b3b3b3]">App will restart shortly</span>
        {:else if isDownloading}
          <span class="font-semibold">Downloading v{updateVersion}...</span>
          <span class="text-xs text-[#b3b3b3]">{downloadProgress}%</span>
        {:else}
          <span class="font-semibold">SpotyCloud v{updateVersion} available</span>
          {#if updateBody}
            <span class="text-xs text-[#b3b3b3] truncate max-w-[200px]">{updateBody}</span>
          {/if}
        {/if}
      </div>
    </div>

    <div class="update-actions">
      {#if isDownloading}
        <div class="progress-bar">
          <div class="progress-fill" style="width: {downloadProgress}%"></div>
        </div>
      {:else if isInstalling}
        <RefreshCw class="w-4 h-4 animate-spin text-white" />
      {:else}
        <button onclick={downloadAndInstall} class="update-btn">
          Update
        </button>
        <button onclick={() => dismissed = true} class="dismiss-btn">
          <X class="w-3.5 h-3.5" />
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .update-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: linear-gradient(90deg, #1db954 0%, #1aa34a 100%);
    color: white;
    font-size: 13px;
    gap: 12px;
    z-index: 100;
    flex-shrink: 0;
  }
  .update-content {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .update-icon {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(255,255,255,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .update-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .update-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  .update-btn {
    padding: 4px 16px;
    background: white;
    color: #121212;
    font-weight: 700;
    font-size: 12px;
    border-radius: 9999px;
    transition: transform 0.15s, opacity 0.15s;
  }
  .update-btn:hover {
    transform: scale(1.04);
    opacity: 0.9;
  }
  .dismiss-btn {
    padding: 4px;
    border-radius: 50%;
    color: rgba(255,255,255,0.8);
    transition: background 0.15s, color 0.15s;
  }
  .dismiss-btn:hover {
    background: rgba(255,255,255,0.2);
    color: white;
  }
  .progress-bar {
    width: 100px;
    height: 4px;
    background: rgba(255,255,255,0.3);
    border-radius: 2px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: white;
    border-radius: 2px;
    transition: width 0.3s;
  }
</style>
