import { loadDataSync, loadData, saveData } from '$lib/utils/storage';

const STORAGE_KEY = 'spotycloud_client_id';

let cachedId: string | null = loadDataSync<string | null>(STORAGE_KEY, null);

export async function initAuthStorage() {
  cachedId = await loadData<string | null>(STORAGE_KEY, null);
}

export function getClientId(): string | null {
  return cachedId;
}

export function setClientId(clientId: string): void {
  cachedId = clientId;
  saveData(STORAGE_KEY, clientId);
}

export function clearClientId(): void {
  cachedId = null;
  saveData(STORAGE_KEY, null);
}
