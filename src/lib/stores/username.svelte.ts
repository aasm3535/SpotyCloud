import { invoke } from '@tauri-apps/api/core';

let username = $state('User');

export async function initUsername() {
  try {
    username = await invoke<string>('get_username');
  } catch {
    username = 'User';
  }
}

export function getUsername() {
  return {
    get value() { return username; }
  };
}
