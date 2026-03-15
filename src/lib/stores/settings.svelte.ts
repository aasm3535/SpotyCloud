import { loadDataSync, loadData, saveData } from '$lib/utils/storage';

const STORAGE_KEY = 'app_settings';

interface AppSettings {
  alwaysCollapsedSidebar: boolean;
}

const defaults: AppSettings = { alwaysCollapsedSidebar: false };

let settings = $state<AppSettings>(loadDataSync(STORAGE_KEY, defaults));

export async function initSettings() {
  settings = await loadData<AppSettings>(STORAGE_KEY, defaults);
}

function save() {
  saveData(STORAGE_KEY, settings);
}

export function getSettings() {
  return {
    get alwaysCollapsedSidebar() { return settings.alwaysCollapsedSidebar; },
  };
}

export function setAlwaysCollapsedSidebar(value: boolean) {
  settings.alwaysCollapsedSidebar = value;
  save();
}
