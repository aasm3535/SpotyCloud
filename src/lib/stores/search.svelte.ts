import type { SCTrack, SCSearchResult } from '$lib/api/types';
import { searchTracks, fetchNextPage } from '$lib/api/soundcloud';

let query = $state('');
let results = $state<SCTrack[]>([]);
let isLoading = $state(false);
let error = $state<string | null>(null);
let nextHref = $state<string | null>(null);
let totalResults = $state(0);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function getSearch() {
  return {
    get query() { return query; },
    set query(value: string) { query = value; },
    get results() { return results; },
    get isLoading() { return isLoading; },
    get error() { return error; },
    get hasMore() { return nextHref !== null; },
    get totalResults() { return totalResults; },
    submit: () => performSearch(query),
  };
}

export function setQuery(q: string) {
  query = q;
  if (debounceTimer) clearTimeout(debounceTimer);
  if (!q.trim()) {
    results = [];
    nextHref = null;
    totalResults = 0;
    error = null;
    return;
  }
  debounceTimer = setTimeout(() => performSearch(q), 300);
}

async function performSearch(q: string) {
  isLoading = true;
  error = null;
  try {
    const data = await searchTracks(q, 20, 0);
    results = data.collection;
    nextHref = data.next_href;
    totalResults = data.total_results;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Search failed';
    results = [];
  } finally {
    isLoading = false;
  }
}

export async function loadMore() {
  if (!nextHref || isLoading) return;
  isLoading = true;
  try {
    const data = await fetchNextPage<SCTrack>(nextHref);
    results = [...results, ...data.collection];
    nextHref = data.next_href;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load more';
  } finally {
    isLoading = false;
  }
}
