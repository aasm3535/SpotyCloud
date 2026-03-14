const STORAGE_KEY = 'symptom_client_id';

export function getClientId(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function setClientId(clientId: string): void {
  localStorage.setItem(STORAGE_KEY, clientId);
}

export function clearClientId(): void {
  localStorage.removeItem(STORAGE_KEY);
}
