import { TMDB_GENRE_MAP } from './genres';

/** TMDB keyword IDs used by discover filters */
export const TMDB_KEYWORDS = {
  sequel: 9663,
  prequel: 9675,
  independentFilm: 9887,
  oscarWinner: 13091,
  oscarNominee: 342818,
  basedOnNovel: 818,
} as const;

/** Major Hollywood studio company IDs on TMDB */
export const MAJOR_STUDIO_IDS = [
  2, // Walt Disney Pictures
  3, // Pixar
  4, // Paramount
  5, // Columbia Pictures
  33, // Universal
  174, // Warner Bros
  420, // Marvel Studios
  521, // DreamWorks
  9195, // Lionsgate
  7505, // Netflix (studio arm)
  128064, // Disney+
];

export type DiscoveryMode = 'taste' | 'tmdbBrowse';
export type BrowseLayout = 'grid' | 'list';
export type ReleaseWindow = '30' | '60' | '90' | '365' | 'all';
export type SortBy =
  | 'popularity.desc'
  | 'release_date.desc'
  | 'vote_average.desc'
  | 'revenue.desc';

export type WatchMonetizationType = 'flatrate' | 'free' | 'ads' | 'rent' | 'buy';

export interface TmdbBrowseFilters {
  genreIds: number[];
  releaseWindow: ReleaseWindow;
  minVoteAverage: number;
  minVoteCount: number;
  maxRuntime: number | null;
  excludeAdult: boolean;
  indieFocus: boolean;
  excludeOscarNomineesAndWinners: boolean;
  oscarExcludeYears: number;
  excludeSequels: boolean;
  excludeFranchise: boolean;
  maxBudgetMillions: number | null;
  watchRegion: string;
  watchProviderIds: number[];
  watchMonetizationTypes: WatchMonetizationType[];
  sortBy: SortBy;
  page: number;
}

export const DEFAULT_BROWSE_FILTERS: TmdbBrowseFilters = {
  genreIds: [],
  releaseWindow: '90',
  minVoteAverage: 6.5,
  minVoteCount: 100,
  maxRuntime: null,
  excludeAdult: true,
  indieFocus: true,
  excludeOscarNomineesAndWinners: false,
  oscarExcludeYears: 5,
  excludeSequels: true,
  excludeFranchise: true,
  maxBudgetMillions: 50,
  watchRegion: 'US',
  watchProviderIds: [],
  watchMonetizationTypes: ['flatrate'],
  sortBy: 'release_date.desc',
  page: 1,
};

export const RELEASE_WINDOW_OPTIONS: { value: ReleaseWindow; label: string }[] = [
  { value: '30', label: 'Last 30 days' },
  { value: '60', label: 'Last 60 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last year' },
  { value: 'all', label: 'Any time' },
];

export const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'release_date.desc', label: 'Newest' },
  { value: 'popularity.desc', label: 'Popular' },
  { value: 'vote_average.desc', label: 'Top rated' },
  { value: 'revenue.desc', label: 'Box office' },
];

export const GENRE_OPTIONS = Object.entries(TMDB_GENRE_MAP).map(([id, name]) => ({
  id: Number(id),
  name,
}));

export const WATCH_REGION_OPTIONS: { value: string; label: string }[] = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'AU', label: 'Australia' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'ES', label: 'Spain' },
  { value: 'IT', label: 'Italy' },
  { value: 'MX', label: 'Mexico' },
  { value: 'BR', label: 'Brazil' },
  { value: 'IN', label: 'India' },
  { value: 'JP', label: 'Japan' },
];

export const MONETIZATION_OPTIONS: { value: WatchMonetizationType; label: string }[] = [
  { value: 'flatrate', label: 'Subscription' },
  { value: 'free', label: 'Free' },
  { value: 'ads', label: 'Ad-supported' },
  { value: 'rent', label: 'Rent' },
  { value: 'buy', label: 'Buy' },
];

export interface FilterGroup {
  id: string;
  title: string;
  priority: 'signature' | 'core' | 'v2' | 'nice';
  fields: FilterField[];
}

export interface FilterField {
  key: keyof TmdbBrowseFilters;
  label: string;
  description?: string;
  type: 'toggle' | 'slider' | 'select' | 'genres' | 'watchRegion' | 'watchProviders' | 'monetization';
  min?: number;
  max?: number;
  step?: number;
}

export const FILTER_GROUPS: FilterGroup[] = [
  {
    id: 'hard',
    title: 'Hard filters',
    priority: 'core',
    fields: [
      {
        key: 'excludeOscarNomineesAndWinners',
        label: 'Exclude Oscar nominees and winners',
        description: 'Applies only to films within the year window below',
        type: 'toggle',
      },
      {
        key: 'oscarExcludeYears',
        label: 'Oscar filter window',
        description: 'Exclude Oscar titles released within this many years',
        type: 'slider',
        min: 1,
        max: 25,
        step: 1,
      },
      {
        key: 'maxBudgetMillions',
        label: 'Max budget ($M)',
        description: 'Indie ceiling — filters after fetch when TMDB provides budget',
        type: 'slider',
        min: 0,
        max: 200,
        step: 5,
      },
      {
        key: 'releaseWindow',
        label: 'Release window',
        description: 'New releases only',
        type: 'select',
      },
      {
        key: 'indieFocus',
        label: 'Exclude major studios',
        description: 'Warner, Disney, Universal, Paramount, etc.',
        type: 'toggle',
      },
      {
        key: 'excludeSequels',
        label: 'Exclude sequels',
        type: 'toggle',
      },
      {
        key: 'excludeFranchise',
        label: 'Exclude franchise entries',
        description: 'Sequels, prequels, and collection installments',
        type: 'toggle',
      },
    ],
  },
  {
    id: 'quality',
    title: 'Quality signals',
    priority: 'core',
    fields: [
      {
        key: 'minVoteAverage',
        label: 'Min vote average',
        type: 'slider',
        min: 0,
        max: 10,
        step: 0.5,
      },
      {
        key: 'minVoteCount',
        label: 'Min vote count',
        description: 'Crowd-verified — avoids hyped-but-unseen titles',
        type: 'slider',
        min: 0,
        max: 5000,
        step: 50,
      },
    ],
  },
  {
    id: 'mood',
    title: 'Mood & tone',
    priority: 'core',
    fields: [
      {
        key: 'genreIds',
        label: 'Genres',
        type: 'genres',
      },
      {
        key: 'maxRuntime',
        label: 'Max runtime (min)',
        description: 'Skip epics when you want something shorter',
        type: 'slider',
        min: 60,
        max: 240,
        step: 15,
      },
      {
        key: 'excludeAdult',
        label: 'Exclude adult content',
        type: 'toggle',
      },
    ],
  },
  {
    id: 'streaming',
    title: 'Streaming',
    priority: 'nice',
    fields: [
      {
        key: 'watchRegion',
        label: 'Region',
        description: 'Availability is country-specific (via JustWatch on TMDB)',
        type: 'watchRegion',
      },
      {
        key: 'watchProviderIds',
        label: 'Streaming services',
        description: 'Search to add services — your selections are saved',
        type: 'watchProviders',
      },
      {
        key: 'watchMonetizationTypes',
        label: 'How to watch',
        type: 'monetization',
      },
    ],
  },
];

export function releaseDateGte(window: ReleaseWindow): string | undefined {
  if (window === 'all') return undefined;
  const days = Number(window);
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export function filtersAreDefault(filters: TmdbBrowseFilters): boolean {
  const { page: _page, ...current } = filters;
  const { page: _defaultPage, ...defaults } = DEFAULT_BROWSE_FILTERS;
  return JSON.stringify(current) === JSON.stringify(defaults);
}

const VALID_MONETIZATION: WatchMonetizationType[] = ['flatrate', 'free', 'ads', 'rent', 'buy'];

export function mergeBrowseFilters(input: Partial<TmdbBrowseFilters> = {}): TmdbBrowseFilters {
  return {
    ...DEFAULT_BROWSE_FILTERS,
    ...input,
    genreIds: Array.isArray(input.genreIds)
      ? input.genreIds.filter((id): id is number => typeof id === 'number')
      : DEFAULT_BROWSE_FILTERS.genreIds,
    watchProviderIds: Array.isArray(input.watchProviderIds)
      ? input.watchProviderIds.filter((id): id is number => typeof id === 'number')
      : DEFAULT_BROWSE_FILTERS.watchProviderIds,
    watchRegion:
      typeof input.watchRegion === 'string' && input.watchRegion.length === 2
        ? input.watchRegion.toUpperCase()
        : DEFAULT_BROWSE_FILTERS.watchRegion,
    watchMonetizationTypes: Array.isArray(input.watchMonetizationTypes)
      ? input.watchMonetizationTypes.filter((type): type is WatchMonetizationType =>
          VALID_MONETIZATION.includes(type as WatchMonetizationType)
        )
      : DEFAULT_BROWSE_FILTERS.watchMonetizationTypes,
    page: typeof input.page === 'number' && input.page > 0 ? input.page : 1,
    oscarExcludeYears:
      typeof input.oscarExcludeYears === 'number'
        ? Math.min(25, Math.max(1, Math.round(input.oscarExcludeYears)))
        : DEFAULT_BROWSE_FILTERS.oscarExcludeYears,
  };
}
