import type { SCTrack } from '$lib/api/types';

let selectedTrackIds = $state<Set<number>>(new Set());
let lastSelectedTrackId = $state<number | null>(null);

export function getTrackSelection() {
  return {
    get selectedIds() { return selectedTrackIds; },
    get hasSelection() { return selectedTrackIds.size > 0; },
    get selectedCount() { return selectedTrackIds.size; },
    get selectedTrackIds() { return Array.from(selectedTrackIds); }
  };
}

export function toggleTrackSelection(trackId: number, multi: boolean = false) {
  if (!multi) {
    // Single selection - clear others
    selectedTrackIds.clear();
    selectedTrackIds.add(trackId);
  } else {
    // Multi selection with Ctrl
    if (selectedTrackIds.has(trackId)) {
      selectedTrackIds.delete(trackId);
    } else {
      selectedTrackIds.add(trackId);
    }
  }
  lastSelectedTrackId = trackId;
  selectedTrackIds = selectedTrackIds; // Trigger reactivity
}

export function clearTrackSelection() {
  selectedTrackIds.clear();
  lastSelectedTrackId = null;
  selectedTrackIds = selectedTrackIds;
}

export function isTrackSelected(trackId: number): boolean {
  return selectedTrackIds.has(trackId);
}