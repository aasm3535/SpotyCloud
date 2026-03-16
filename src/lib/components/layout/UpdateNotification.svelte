<script lang="ts">
  import { onMount } from 'svelte';
  import { X, Download, RefreshCw, CheckCircle } from 'lucide-svelte';
  import { loadData, saveData } from '$lib/utils/storage';

  let updateAvailable = $state(false);
  let updateVersion = $state('');
  let updateBody = $state('');
  let isDownloading = $state(false);
  let downloadProgress = $state(0);
  let isInstalling = $state(false);
  let dismissed = $state(false);
  let updateObj: any = null;

  // Post-update success banner
  let justUpdated = $state(false);
  let updatedToVersion = $state('');

  onMount(() => {
    // Check if we just updated
    checkPostUpdate();

    // Check for new updates after 3 seconds
    setTimeout(() => checkForUpdate(), 3000);
    const interval = setInterval(() => checkForUpdate(), 30 * 60 * 1000);
    return () => clearInterval(interval);
  });

  async function checkPostUpdate() {
    try {
      const { getVersion } = await import('@tauri-apps/api/app');
      const currentVersion = await getVersion();
      const lastVersion = await loadData<string | null>('spotycloud_last_version', null);

      if (lastVersion && lastVersion !== currentVersion) {
        justUpdated = true;
        updatedToVersion = currentVersion;
        // Auto-dismiss after 8 seconds
        setTimeout(() => { justUpdated = false; }, 8000);
      }

      // Save current version
      await saveData('spotycloud_last_version', currentVersion);
    } catch (e) {
      console.warn('[Updater] Post-update check failed:', e);
    }
  }

  async function checkForUpdate() {
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update) {
        updateObj = update;
        updateVersion = update.version;
        updateBody = update.body || '';
        updateAvailable = true;
        dismissed = false;
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

      await updateObj.downloadAndInstall((event: any) => {
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

      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (e) {
      console.error('[Updater] Install failed:', e);
      isDownloading = false;
      isInstalling = false;
    }
  }
</script>

{#if justUpdated}
  <div class="update-banner success">
    <div class="update-content">
      <div class="update-icon success-icon">
        <CheckCircle class="w-4 h-4" />
      </div>
      <div class="update-text">
        <span class="font-semibold">SpotyCloud updated to v{updatedToVersion}</span>
      </div>
    </div>
    <button onclick={() => justUpdated = false} class="dismiss-btn">
      <X class="w-3.5 h-3.5" />
    </button>
  </div>
{/if}

{#if updateAvailable && !dismissed}
  <div class="update-banner">
    <div class="update-content">
      <div class="update-icon">
        <Download class="w-4 h-4" />
      </div>
      <div class="update-text">
        {#if isInstalling}
          <span class="font-semibold">Installing update...</span>
          <span class="text-xs opacity-70">App will restart shortly</span>
        {:else if isDownloading}
          <span class="font-semibold">Downloading v{updateVersion}...</span>
          <span class="text-xs opacity-70">{downloadProgress}%</span>
        {:else}
          <span class="font-semibold">SpotyCloud v{updateVersion} available</span>
          {#if updateBody}
            <span class="text-xs opacity-70 truncate max-w-[200px]">{updateBody}</span>
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
  .update-banner.success {
    background: linear-gradient(90deg, #1a8f43 0%, #167a3a 100%);
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
  .success-icon {
    background: rgba(255,255,255,0.25);
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
