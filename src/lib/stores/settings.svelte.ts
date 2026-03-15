const STORAGE_KEY = 'app_settings';

interface AppSettings {
  alwaysCollapsedSidebar: boolean;
}

function load(): AppSettings {
  if (typeof window === 'undefined') return { alwaysCollapsedSidebar: false };
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : { alwaysCollapsedSidebar: false };
  } catch { return { alwaysCollapsedSidebar: false }; }
}

function save(settings: AppSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

let settings = $state<AppSettings>(load());

export function getSettings() {
  return {
    get alwaysCollapsedSidebar() { return settings.alwaysCollapsedSidebar; },
  };
}

export function setAlwaysCollapsedSidebar(value: boolean) {
  settings.alwaysCollapsedSidebar = value;
  save(settings);
}
