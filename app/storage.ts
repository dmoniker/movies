import { Movie, Rating, DismissedRecommendation } from './types';
import { mergeBrowseFilters, type TmdbBrowseFilters } from './tmdb-browse';

const RATINGS_KEY = 'movieRatings';
const MOVIE_CACHE_KEY = 'movieCache';
const ACTIVE_TAB_KEY = 'activeTab';
const DISCOVERY_MODE_KEY = 'discoveryMode';
const BROWSE_STREAMING_KEY = 'browseStreamingPrefs';
const BROWSE_FILTERS_KEY = 'browseFilters';
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

export interface BrowseStreamingPrefs {
  watchRegion: string;
  selectionsByRegion: Record<string, number[]>;
  providerNames: Record<string, string>;
}

const EMPTY_STREAMING_PREFS: BrowseStreamingPrefs = {
  watchRegion: 'US',
  selectionsByRegion: {},
  providerNames: {},
};

export function loadBrowseStreamingPrefs(): BrowseStreamingPrefs {
  if (typeof window === 'undefined') return EMPTY_STREAMING_PREFS;
  const saved = localStorage.getItem(BROWSE_STREAMING_KEY);
  if (!saved) return EMPTY_STREAMING_PREFS;
  try {
    const parsed = JSON.parse(saved) as Partial<BrowseStreamingPrefs>;
    return {
      watchRegion: typeof parsed.watchRegion === 'string' ? parsed.watchRegion : 'US',
      selectionsByRegion:
        parsed.selectionsByRegion && typeof parsed.selectionsByRegion === 'object'
          ? Object.fromEntries(
              Object.entries(parsed.selectionsByRegion).map(([region, ids]) => [
                region,
                Array.isArray(ids) ? ids.filter((id): id is number => typeof id === 'number') : [],
              ])
            )
          : {},
      providerNames:
        parsed.providerNames && typeof parsed.providerNames === 'object'
          ? Object.fromEntries(
              Object.entries(parsed.providerNames).filter(
                (entry): entry is [string, string] => typeof entry[1] === 'string'
              )
            )
          : {},
    };
  } catch {
    return EMPTY_STREAMING_PREFS;
  }
}

export function saveBrowseStreamingPrefs(prefs: BrowseStreamingPrefs): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(BROWSE_STREAMING_KEY, JSON.stringify(prefs));
}

export function streamingSelectionsForRegion(region: string): number[] {
  return loadBrowseStreamingPrefs().selectionsByRegion[region] ?? [];
}

export function persistStreamingSelections(
  region: string,
  providerIds: number[],
  providerNames?: Record<string, string>
): void {
  const prefs = loadBrowseStreamingPrefs();
  prefs.watchRegion = region;
  prefs.selectionsByRegion[region] = providerIds;
  if (providerNames) {
    prefs.providerNames = { ...prefs.providerNames, ...providerNames };
  }
  saveBrowseStreamingPrefs(prefs);
}

export function clearBrowseStreamingPrefs(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(BROWSE_STREAMING_KEY);
}

export function loadSavedBrowseFilters(): TmdbBrowseFilters {
  if (typeof window === 'undefined') return mergeBrowseFilters();
  const saved = localStorage.getItem(BROWSE_FILTERS_KEY);
  if (!saved) return mergeBrowseFilters();
  try {
    return mergeBrowseFilters(JSON.parse(saved) as Partial<TmdbBrowseFilters>);
  } catch {
    return mergeBrowseFilters();
  }
}

export function saveBrowseFilters(filters: TmdbBrowseFilters): void {
  if (typeof window === 'undefined') return;
  const { page: _page, ...stored } = filters;
  localStorage.setItem(BROWSE_FILTERS_KEY, JSON.stringify(stored));
}

export function clearAllBrowsePrefs(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(BROWSE_STREAMING_KEY);
  localStorage.removeItem(BROWSE_FILTERS_KEY);
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
}
