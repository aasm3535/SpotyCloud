import { listen } from '@tauri-apps/api/event';
import { getPlayer, play, pause, next, prev, setVolume, toggleMute } from '$lib/stores/player.svelte';
import { getSettings } from '$lib/stores/settings.svelte';
import { formatHotkey } from '$lib/stores/settings.svelte';
import type { HotkeyBinding, HotkeyAction } from '$lib/stores/settings.svelte';

let unsubscribe: (() => void) | null = null;

export async function initGlobalShortcutListener() {
  // Unsubscribe from previous listener if exists
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  // Listen for global shortcut events from Rust
  unsubscribe = await listen<string>('global-shortcut', (event) => {
    const shortcutStr = event.payload;
    console.log('[GlobalShortcut] Received:', shortcutStr);
    
    const settings = getSettings();
    const player = getPlayer();
    
    // Find matching action
    for (const [action, binding] of Object.entries(settings.hotkeys)) {
      const bindingStr = formatHotkey(binding as HotkeyBinding).toLowerCase();
      if (bindingStr === shortcutStr.toLowerCase()) {
        console.log('[GlobalShortcut] Executing action:', action);
        executeAction(action as HotkeyAction, player);
        break;
      }
    }
  });

  console.log('[GlobalShortcut] Listener initialized');
}

function executeAction(action: HotkeyAction, player: ReturnType<typeof getPlayer>) {
  switch (action) {
    case 'playPause':
      if (player.isPlaying) {
        pause();
      } else if (player.currentTrack) {
        // Resume current track
        const track = player.currentTrack;
        const queue = player.queue;
        const index = player.queueIndex;
        play(track, queue.length > 0 ? queue : [track]);
      }
      break;
    case 'nextTrack':
      next();
      break;
    case 'prevTrack':
      prev();
      break;
    case 'volumeUp':
      setVolume(Math.min(1, player.volume + 0.1));
      break;
    case 'volumeDown':
      setVolume(Math.max(0, player.volume - 0.1));
      break;
    case 'mute':
      toggleMute();
      break;
  }
}

export function cleanupGlobalShortcutListener() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
