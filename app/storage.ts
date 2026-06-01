import { Movie, Rating, Recommendation, DismissedRecommendation } from './types';

const RATINGS_KEY = 'movieRatings';
const MOVIE_CACHE_KEY = 'movieCache';
const ACTIVE_TAB_KEY = 'activeTab';
const DISCOVERY_MODE_KEY = 'discoveryMode';
const GROK_CACHE_KEY = 'grokRecCache';
const DISMISSALS_KEY = 'recDismissals';

export type ActiveTab = 'darcy' | 'wife' | 'shared';
export type DiscoveryMode = 'taste' | 'tmdbBrowse';

export function loadRatings(): Rating[] {
  if (typeof window === 'undefined') return [];
  const saved = localStorage.getItem(RATINGS_KEY);
  if (!saved) return [];
  try {
    return JSON.parse(saved) as Rating[];
  } catch {
    return [];
  }
}

export function saveRatings(ratings: Rating[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(RATINGS_KEY, JSON.stringify(ratings));
}

export function loadMovieCache(): Record<string, Movie> {
  if (typeof window === 'undefined') return {};
  const saved = localStorage.getItem(MOVIE_CACHE_KEY);
  if (!saved) return {};
  try {
    return JSON.parse(saved) as Record<string, Movie>;
  } catch {
    return {};
  }
}

export function saveMovieCache(cache: Record<string, Movie>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MOVIE_CACHE_KEY, JSON.stringify(cache));
}

export function moviesFromCache(cache: Record<string, Movie>): Movie[] {
  return Object.values(cache);
}

export function loadActiveTab(): ActiveTab {
  if (typeof window === 'undefined') return 'darcy';
  const saved = localStorage.getItem(ACTIVE_TAB_KEY);
  if (saved === 'darcy' || saved === 'wife' || saved === 'shared') {
    return saved;
  }
  return 'darcy';
}

export function saveActiveTab(tab: ActiveTab): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACTIVE_TAB_KEY, tab);
}

export function loadDiscoveryMode(): DiscoveryMode {
  if (typeof window === 'undefined') return 'taste';
  const saved = localStorage.getItem(DISCOVERY_MODE_KEY);
  return saved === 'tmdbBrowse' ? 'tmdbBrowse' : 'taste';
}

export function saveDiscoveryMode(mode: DiscoveryMode): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DISCOVERY_MODE_KEY, mode);
}

interface GrokCacheStore {
  [cacheKey: string]: Recommendation[];
}

export function loadGrokCacheEntry(cacheKey: string): Recommendation[] | null {
  if (typeof window === 'undefined') return null;
  const saved = localStorage.getItem(GROK_CACHE_KEY);
  if (!saved) return null;
  try {
    const store = JSON.parse(saved) as GrokCacheStore;
    return store[cacheKey] ?? null;
  } catch {
    return null;
  }
}

export function saveGrokCacheEntry(cacheKey: string, recommendations: Recommendation[]): void {
  if (typeof window === 'undefined') return;
  let store: GrokCacheStore = {};
  const saved = localStorage.getItem(GROK_CACHE_KEY);
  if (saved) {
    try {
      store = JSON.parse(saved) as GrokCacheStore;
    } catch {
      store = {};
    }
  }
  store[cacheKey] = recommendations;
  const keys = Object.keys(store);
  if (keys.length > 20) {
    for (const key of keys.slice(0, keys.length - 20)) {
      delete store[key];
    }
  }
  localStorage.setItem(GROK_CACHE_KEY, JSON.stringify(store));
}

export function clearGrokCache(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(GROK_CACHE_KEY);
}

export function loadDismissals(): DismissedRecommendation[] {
  if (typeof window === 'undefined') return [];
  const saved = localStorage.getItem(DISMISSALS_KEY);
  if (!saved) return [];
  try {
    return JSON.parse(saved) as DismissedRecommendation[];
  } catch {
    return [];
  }
}

export function saveDismissals(dismissals: DismissedRecommendation[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DISMISSALS_KEY, JSON.stringify(dismissals));
}

export interface BackupData {
  ratings: Rating[];
  movieCache: Record<string, Movie>;
  dismissals: DismissedRecommendation[];
}

export function parseBackupFile(content: string): BackupData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Backup file is not valid JSON');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Backup file is not a valid object');
  }

  const record = parsed as Record<string, unknown>;

  if (!Array.isArray(record.ratings)) {
    throw new Error('Backup is missing ratings');
  }

  if (!record.movieCache || typeof record.movieCache !== 'object' || Array.isArray(record.movieCache)) {
    throw new Error('Backup is missing movie cache');
  }

  return {
    ratings: record.ratings as Rating[],
    movieCache: record.movieCache as Record<string, Movie>,
    dismissals: Array.isArray(record.dismissals)
      ? (record.dismissals as DismissedRecommendation[])
      : [],
  };
}

export function applyBackup(data: BackupData): void {
  saveRatings(data.ratings);
  saveMovieCache(data.movieCache);
  saveDismissals(data.dismissals);
  clearGrokCache();
}
