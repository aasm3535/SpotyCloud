import { getClientId, setClientId, clearClientId } from '$lib/api/auth';
import { setApiClientId, testConnection } from '$lib/api/soundcloud';

let isAuthenticated = $state(false);
let storedClientId = $state<string | null>(null);

export function initAuth() {
  const id = getClientId();
  if (id) {
    storedClientId = id;
    setApiClientId(id);
    isAuthenticated = true;
  }
}

export async function login(clientId: string): Promise<{ success: boolean; error?: string }> {
  setApiClientId(clientId);
  const result = await testConnection();
  if (result.success) {
    setClientId(clientId);
    storedClientId = clientId;
    isAuthenticated = true;
  }
  return result;
}

export function logout() {
  clearClientId();
  storedClientId = null;
  isAuthenticated = false;
}

export function getAuth() {
  return {
    get isAuthenticated() { return isAuthenticated; },
    get clientId() { return storedClientId; },
  };
}
