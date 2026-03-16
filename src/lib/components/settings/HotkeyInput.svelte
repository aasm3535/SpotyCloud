<script lang="ts">
  import type { HotkeyBinding, HotkeyAction } from '$lib/stores/settings.svelte';
  import { formatHotkey, checkHotkeyConflict } from '$lib/stores/settings.svelte';
  
  interface Props {
    binding: HotkeyBinding;
    action: HotkeyAction;
    onChange: (binding: HotkeyBinding) => void;
    conflict?: string | null;
  }
  
  let { binding, action, onChange, conflict = null }: Props = $props();
  
  let isCapturing = $state(false);
  let capturedKeys = $state<string[]>([]);
  let capturedModifiers = $state<string[]>([]);
  let displayValue = $state(formatHotkey(binding));
  let errorMessage = $state<string | null>(null);
  
  function startCapture() {
    isCapturing = true;
    capturedKeys = [];
    capturedModifiers = [];
    errorMessage = null;
    displayValue = 'Нажмите клавиши...';
  }
  
  function cancelCapture() {
    isCapturing = false;
    capturedKeys = [];
    capturedModifiers = [];
    displayValue = formatHotkey(binding);
    errorMessage = null;
  }
  
  function handleKeyDown(e: KeyboardEvent) {
    if (!isCapturing) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const modifiers: string[] = [];
    if (e.ctrlKey) modifiers.push('Ctrl');
    if (e.altKey) modifiers.push('Alt');
    if (e.shiftKey) modifiers.push('Shift');
    if (e.metaKey) modifiers.push('Win');
    
    // Get the key name
    let key = e.key;
    
    // Handle special keys
    if (key === ' ') key = 'Space';
    if (key.length === 1) key = key.toUpperCase();
    
    // Ignore modifier-only presses
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
    
    if (capturedKeys.length === 0) {
      // First key press - store modifiers and key
      capturedModifiers = modifiers;
      capturedKeys = [key];
      displayValue = formatHotkey({ action, key, modifiers });
    } else if (capturedKeys.length === 1 && modifiers.length === 0) {
      // Second key press without modifiers - create combo
      capturedKeys.push(key);
      const newBinding: HotkeyBinding = {
        action,
        key: capturedKeys[0],
        combo: key
      };
      
      // Check for conflicts
      const conflictMsg = checkHotkeyConflict(newBinding);
      if (conflictMsg) {
        errorMessage = conflictMsg;
        return;
      }
      
      onChange(newBinding);
      isCapturing = false;
      displayValue = formatHotkey(newBinding);
    } else {
      // New binding with modifiers
      const newBinding: HotkeyBinding = {
        action,
        key,
        modifiers
      };
      
      // Check for conflicts
      const conflictMsg = checkHotkeyConflict(newBinding);
      if (conflictMsg) {
        errorMessage = conflictMsg;
        return;
      }
      
      onChange(newBinding);
      isCapturing = false;
      displayValue = formatHotkey(newBinding);
    }
  }
  
  function handleKeyUp(e: KeyboardEvent) {
    if (!isCapturing) return;
    
    // If we captured a key and released it without combo
    if (capturedKeys.length === 1 && !capturedModifiers.length && e.key === capturedKeys[0]) {
      const newBinding: HotkeyBinding = {
        action,
        key: capturedKeys[0]
      };
      
      // Check for conflicts
      const conflictMsg = checkHotkeyConflict(newBinding);
      if (conflictMsg) {
        errorMessage = conflictMsg;
        return;
      }
      
      onChange(newBinding);
      isCapturing = false;
      displayValue = formatHotkey(newBinding);
    }
  }
  
  $effect(() => {
    if (isCapturing) {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      };
    }
  });
</script>

<div class="hotkey-input-container">
  <button 
    class="hotkey-input" 
    class:capturing={isCapturing}
    class:has-conflict={errorMessage || conflict}
    onclick={startCapture}
    type="button"
  >
    {displayValue}
  </button>
  
  {#if isCapturing}
    <button class="cancel-btn" onclick={cancelCapture} type="button">✕</button>
  {/if}
</div>

{#if errorMessage}
  <div class="error-message">{errorMessage}</div>
{/if}

{#if conflict && !errorMessage}
  <div class="conflict-message">{conflict}</div>
{/if}

<style>
  .hotkey-input-container {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  
  .hotkey-input {
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: white;
    font-family: monospace;
    font-size: 14px;
    min-width: 120px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .hotkey-input:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
  }
  
  .hotkey-input.capturing {
    background: rgba(34, 197, 94, 0.2);
    border-color: #22c55e;
    animation: pulse 1s infinite;
  }
  
  .hotkey-input.has-conflict {
    border-color: #ef4444;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  
  .cancel-btn {
    padding: 8px 12px;
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid rgba(239, 68, 68, 0.5);
    border-radius: 6px;
    color: #ef4444;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .cancel-btn:hover {
    background: rgba(239, 68, 68, 0.3);
  }
  
  .error-message, .conflict-message {
    margin-top: 4px;
    font-size: 12px;
    color: #ef4444;
  }
</style>
