const STORAGE_KEY = 'spotycloud_onboarding_done';

let onboardingDone = $state(false);

export function initOnboarding() {
  if (typeof localStorage === 'undefined') return;
  onboardingDone = localStorage.getItem(STORAGE_KEY) === 'true';
}

export function completeOnboarding() {
  onboardingDone = true;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, 'true');
  }
}

export function resetOnboarding() {
  onboardingDone = false;
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function getOnboarding() {
  return {
    get done() { return onboardingDone; },
  };
}
