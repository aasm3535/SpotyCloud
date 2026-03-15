import { loadDataSync, loadData, saveData } from '$lib/utils/storage';

const STORAGE_KEY = 'spotycloud_onboarding_done';

let onboardingDone = $state(loadDataSync(STORAGE_KEY, false));

export async function initOnboarding() {
  onboardingDone = await loadData<boolean>(STORAGE_KEY, false);
}

export function completeOnboarding() {
  onboardingDone = true;
  saveData(STORAGE_KEY, true);
}

export function resetOnboarding() {
  onboardingDone = false;
  saveData(STORAGE_KEY, false);
}

export function getOnboarding() {
  return {
    get done() { return onboardingDone; },
  };
}
