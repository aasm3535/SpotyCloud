import { invoke } from '@tauri-apps/api/core';
import type { HotkeyBinding, HotkeyAction } from '$lib/stores/settings.svelte';

export interface HotkeyConfig {
  action: string;
  key: string;
  modifiers?: string[];
  combo?: string;
}

function bindingToConfig(binding: HotkeyBinding): HotkeyConfig {
  return {
    action: binding.action,
    key: binding.key,
    modifiers: binding.modifiers,
    combo: binding.combo
  };
}

export async function registerShortcut(binding: HotkeyBinding): Promise<void> {
  try {
    await invoke('register_global_shortcut', {
      config: bindingToConfig(binding)
    });
  } catch (error) {
    console.error('Failed to register shortcut:', error);
    throw error;
  }
}

export async function unregisterShortcut(binding: HotkeyBinding): Promise<void> {
  try {
    await invoke('unregister_global_shortcut', {
      config: bindingToConfig(binding)
    });
  } catch (error) {
    console.error('Failed to unregister shortcut:', error);
    throw error;
  }
}

export async function unregisterAllShortcuts(): Promise<void> {
  try {
    await invoke('unregister_all_shortcuts');
  } catch (error) {
    console.error('Failed to unregister all shortcuts:', error);
    throw error;
  }
}

export async function registerAllShortcuts(bindings: Record<HotkeyAction, HotkeyBinding>): Promise<void> {
  // First unregister all existing
  await unregisterAllShortcuts();
  
  // Register each shortcut
  for (const binding of Object.values(bindings)) {
    try {
      await registerShortcut(binding);
    } catch (error) {
      console.warn(`Failed to register shortcut for ${binding.action}:`, error);
    }
  }
}
