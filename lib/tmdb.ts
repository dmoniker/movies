import { Movie, Rating, UserId } from '@/app/types';
import { genreIdsToNames, genreNamesToIds } from '@/app/genres';
import { calculateTasteProfile } from '@/app/utils';
import { getTmdbApiKey } from '@/lib/env';
import type { TmdbBrowseFilters } from '@/app/tmdb-browse';
import {
  MAJOR_STUDIO_IDS,
  TMDB_KEYWORDS,
  OBSCURITY_MAX_POPULARITY,
  OBSCURITY_MAX_VOTE_COUNT,
  TMDB_ANIMATION_GENRE_ID,
  releaseDateGte,
  releaseDateGteFromYears,
} from '@/app/tmdb-browse';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w185';

interface TmdbMovieListItem {
  id: number;
  title: string;
  release_date?: string;
  genre_ids?: number[];
  overview?: string;
  poster_path?: string | null;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
}

interface TmdbCastMember {
  name: string;
}

interface TmdbCrewMember {
  name: string;
  job: string;
}

interface TmdbMovieDetail extends TmdbMovieListItem {
  genres?: { id: number; name: string }[];
  runtime?: number;
  budget?: number;
  revenue?: number;
  imdb_id?: string | null;
  belongs_to_collection?: { id: number; name: string } | null;
  credits?: {
    cast?: TmdbCastMember[];
    crew?: TmdbCrewMember[];
  };
}

interface TmdbDiscoverResponse extends TmdbListResponse {
  total_pages: number;
  total_results: number;
  page: number;
}

interface TmdbListResponse {
  results: TmdbMovieListItem[];
}

interface TmdbPerson {
  id: number;
  name: string;
  known_for_department?: string;
  popularity?: number;
}

interface TmdbPersonSearchResponse {
  results: TmdbPerson[];
}

interface TmdbCreditEntry {
  id: number;
  title: string;
  release_date?: string;
  genre_ids?: number[];
  overview?: string;
  poster_path?: string | null;
  job?: string;
  department?: string;
}

interface TmdbPersonCredits {
  cast?: TmdbCreditEntry[];
  crew?: TmdbCreditEntry[];
}

function getApiKey(): string {
  return getTmdbApiKey();
}

async function tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set('api_key', getApiKey());
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`TMDB request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

function yearFromReleaseDate(releaseDate?: string): number {
  if (!releaseDate) return new Date().getFullYear();
  const year = Number.parseInt(releaseDate.slice(0, 4), 10);
  return Number.isFinite(year) ? year : new Date().getFullYear();
}

function mapListItem(movie: TmdbMovieListItem): Movie {
  const genreIds = movie.genre_ids ?? [];
  return {
    id: String(movie.id),
    title: movie.title,
    year: yearFromReleaseDate(movie.release_date),
    genres: genreIdsToNames(genreIds),
    genreIds,
    director: '',
    actors: [],
    poster: movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : undefined,
    description: movie.overview || '',
    voteAverage: movie.vote_average,
    voteCount: movie.vote_count,
    releaseDate: movie.release_date,
    popularity: movie.popularity,
  };
}

function mapDetail(movie: TmdbMovieDetail): Movie {
  const genreIds = movie.genres?.map((g) => g.id) ?? movie.genre_ids ?? [];
  const director =
    movie.credits?.crew?.find((member) => member.job === 'Director')?.name || 'Unknown';
  const actors = movie.credits?.cast?.slice(0, 5).map((member) => member.name) ?? [];

  return {
    id: String(movie.id),
    title: movie.title,
    year: yearFromReleaseDate(movie.release_date),
    genres: movie.genres?.map((g) => g.name) ?? genreIdsToNames(genreIds),
    genreIds,
    director,
    actors,
    poster: movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : undefined,
    description: movie.overview || '',
    voteAverage: movie.vote_average,
    voteCount: movie.vote_count,
    releaseDate: movie.release_date,
    runtime: movie.runtime,
    budget: movie.budget,
    revenue: movie.revenue,
    inCollection: Boolean(movie.belongs_to_collection),
    imdbId: movie.imdb_id ?? undefined,
  };
}

export async function fetchPopularMovies(page = 1): Promise<Movie[]> {
  const data = await tmdbFetch<TmdbListResponse>('/movie/popular', {
    page: String(page),
  });
  return data.results.map(mapListItem);
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function namePartMatches(part: string, queryPart: string): boolean {
  return part === queryPart || part.startsWith(queryPart) || queryPart.startsWith(part);
}

function scorePersonMatch(person: TmdbPerson, query: string): number {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedName = normalizeSearchText(person.name);
  if (!normalizedQuery || !normalizedName) return 0;

  const queryParts = normalizedQuery.split(' ').filter(Boolean);
  const nameParts = normalizedName.split(' ').filter(Boolean);
  const firstName = nameParts[0] ?? '';
  const lastName = nameParts[nameParts.length - 1] ?? '';
  let score = 0;

  if (normalizedName === normalizedQuery) {
    score = 100;
  }

  if (queryParts.length >= 2) {
    const allPartsMatch = queryParts.every((queryPart) =>
      nameParts.some((namePart) => namePartMatches(namePart, queryPart))
    );
    if (allPartsMatch) {
      score = Math.max(score, 95);
    }
  }

  if (queryParts.length === 1) {
    const queryPart = queryParts[0];
    const matchesLast = namePartMatches(lastName, queryPart);
    const matchesFirst = namePartMatches(firstName, queryPart);
    const matchesAny = nameParts.some((namePart) => namePartMatches(namePart, queryPart));

    if (matchesLast && matchesFirst) {
      score = Math.max(score, 94);
    } else if (matchesLast) {
      score = Math.max(score, 90);
    } else if (matchesFirst) {
      score = Math.max(score, 88);
    } else if (matchesAny) {
      score = Math.max(score, 84);
    }
  }

  if (normalizedName.includes(normalizedQuery)) {
    score = Math.max(score, 78);
  }

  if (person.known_for_department === 'Directing') {
    score += 25;
  }

  score += Math.min((person.popularity ?? 0) / 5, 20);

  return score;
}

function mapDirectorCredit(credit: TmdbCreditEntry, directorName: string): Movie {
  const genreIds = credit.genre_ids ?? [];
  return {
    id: String(credit.id),
    title: credit.title,
    year: yearFromReleaseDate(credit.release_date),
    genres: genreIdsToNames(genreIds),
    genreIds,
    director: directorName,
    actors: [],
    poster: credit.poster_path ? `${TMDB_IMAGE_BASE}${credit.poster_path}` : undefined,
    description: credit.overview || '',
  };
}

async function searchPeople(query: string): Promise<TmdbPerson[]> {
  const data = await tmdbFetch<TmdbPersonSearchResponse>('/search/person', {
    query,
    include_adult: 'false',
  });
  return data.results;
}

async function fetchMoviesByDirector(personId: number, directorName: string): Promise<Movie[]> {
  const data = await tmdbFetch<TmdbPersonCredits>(`/person/${personId}/movie_credits`);

  return (data.crew ?? [])
    .filter((credit) => credit.job === 'Director' && credit.title)
    .map((credit) => mapDirectorCredit(credit, directorName))
    .sort((a, b) => b.year - a.year);
}

async function searchByTitle(query: string, page = 1): Promise<Movie[]> {
  const data = await tmdbFetch<TmdbListResponse>('/search/movie', {
    query,
    page: String(page),
    include_adult: 'false',
  });
  return data.results.map(mapListItem);
}

async function getDirectorMatches(query: string) {
  const people = await searchPeople(query);
  return people
    .map((person) => ({ person, score: scorePersonMatch(person, query) }))
    .filter(({ score, person }) => score >= 60 && person.known_for_department === 'Directing')
    .sort((a, b) => b.score - a.score)
    .slice(0, 1);
}

async function searchByDirector(query: string): Promise<{ movies: Movie[]; matchedDirector?: string }> {
  const matches = await getDirectorMatches(query);
  if (matches.length === 0) {
    return { movies: [] };
  }

  const filmographies = await Promise.all(
    matches.map(({ person }) => fetchMoviesByDirector(person.id, person.name))
  );

  const merged = new Map<string, Movie>();
  for (const movies of filmographies) {
    for (const movie of movies) {
      merged.set(movie.id, movie);
    }
  }

  return {
    movies: Array.from(merged.values()).sort((a, b) => b.year - a.year),
    matchedDirector: matches[0].person.name,
  };
}

export type SearchMode = 'title' | 'director' | 'all';

export interface SearchResult {
  movies: Movie[];
  matchedDirector?: string;
}

export async function searchCatalog(query: string, mode: SearchMode = 'title'): Promise<SearchResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { movies: [] };
  }

  if (mode === 'title') {
    return { movies: await searchByTitle(trimmed) };
  }

  if (mode === 'director') {
    return searchByDirector(trimmed);
  }

  const [titleResults, matches] = await Promise.all([
    searchByTitle(trimmed),
    getDirectorMatches(trimmed),
  ]);

  const merged = new Map<string, Movie>();
  for (const movie of titleResults) {
    merged.set(movie.id, movie);
  }

  const strongMatch = matches.find(({ score }) => score >= 80);
  let matchedDirector: string | undefined;

  if (strongMatch) {
    matchedDirector = strongMatch.person.name;
    const directorMovies = await fetchMoviesByDirector(
      strongMatch.person.id,
      strongMatch.person.name
    );
    for (const movie of directorMovies) {
      if (!merged.has(movie.id)) {
        merged.set(movie.id, movie);
      }
    }
  }

  return {
    movies: Array.from(merged.values()),
    matchedDirector,
  };
}

/** @deprecated Use searchCatalog */
export async function searchMovies(query: string, mode: SearchMode = 'title'): Promise<Movie[]> {
  const result = await searchCatalog(query, mode);
  return result.movies;
}

export async function enrichMoviesWithDirectors(movies: Movie[], limit = 20): Promise<Movie[]> {
  const toEnrich = movies.filter((movie) => !movie.director).slice(0, limit);
  if (toEnrich.length === 0) return movies;

  const enriched = await Promise.all(
    toEnrich.map((movie) =>
      fetchMovieDetails(movie.id).catch(() => movie)
    )
  );

  const enrichedById = new Map(enriched.map((movie) => [movie.id, movie]));
  return movies.map((movie) => enrichedById.get(movie.id) ?? movie);
}

export async function fetchMovieDetails(movieId: string): Promise<Movie> {
  const data = await tmdbFetch<TmdbMovieDetail>(`/movie/${movieId}`, {
    append_to_response: 'credits',
  });
  return mapDetail(data);
}

interface TmdbVideo {
  key: string;
  site: string;
  type: string;
  official: boolean;
  iso_639_1?: string;
}

interface TmdbVideosResponse {
  results: TmdbVideo[];
}

function pickYouTubeTrailerKey(videos: TmdbVideo[]): string | null {
  const youtube = videos.filter((video) => video.site === 'YouTube');
  if (youtube.length === 0) return null;

  const trailers = youtube.filter((video) => video.type === 'Trailer');
  const teasers = youtube.filter((video) => video.type === 'Teaser');
  const pool = trailers.length > 0 ? trailers : teasers.length > 0 ? teasers : youtube;

  const official = pool.find((video) => video.official);
  if (official) return official.key;

  const english = pool.find((video) => video.iso_639_1 === 'en');
  return (english ?? pool[0]).key;
}

export async function fetchMovieTrailerYouTubeKey(movieId: string): Promise<string | null> {
  const data = await tmdbFetch<TmdbVideosResponse>(`/movie/${movieId}/videos`);
  return pickYouTubeTrailerKey(data.results);
}

export async function fetchDiscoverMovies(
  genreIds: number[],
  excludeIds: Set<string>,
  page = 1
): Promise<Movie[]> {
  if (genreIds.length === 0) {
    return fetchPopularMovies(page);
  }

  const data = await tmdbFetch<TmdbListResponse>('/discover/movie', {
    with_genres: genreIds.slice(0, 3).join(','),
    sort_by: 'vote_average.desc',
    'vote_count.gte': '200',
    page: String(page),
  });

  return data.results.map(mapListItem).filter((movie) => !excludeIds.has(movie.id));
}

export interface DiscoverBrowseResult {
  movies: Movie[];
  page: number;
  totalPages: number;
  totalResults: number;
}

function buildDiscoverParams(filters: TmdbBrowseFilters): Record<string, string> {
  const params: Record<string, string> = {
    sort_by: filters.sortBy,
    page: String(filters.page),
    include_adult: filters.excludeAdult ? 'false' : 'true',
    'vote_average.gte': String(filters.minVoteAverage),
    'vote_count.gte': String(
      Math.min(filters.minVoteCount, OBSCURITY_MAX_VOTE_COUNT[filters.obscurityLevel])
    ),
    'popularity.lte': String(OBSCURITY_MAX_POPULARITY[filters.obscurityLevel]),
    'vote_count.lte': String(OBSCURITY_MAX_VOTE_COUNT[filters.obscurityLevel]),
  };

  const releaseDates: string[] = [];

  const releaseGte = releaseDateGte(filters.releaseWindow);
  if (releaseGte) {
    releaseDates.push(releaseGte);
  }

  if (filters.excludeOlderThanEnabled) {
    releaseDates.push(releaseDateGteFromYears(filters.maxMovieAgeYears));
  }

  if (releaseDates.length > 0) {
    params['primary_release_date.gte'] = releaseDates.sort().reverse()[0];
  }

  if (filters.formatFilter === 'animated') {
    const otherGenres = filters.genreIds.filter((id) => id !== TMDB_ANIMATION_GENRE_ID);
    params.with_genres =
      otherGenres.length > 0
        ? [TMDB_ANIMATION_GENRE_ID, ...otherGenres].join(',')
        : String(TMDB_ANIMATION_GENRE_ID);
  } else if (filters.genreIds.length > 0) {
    params.with_genres = filters.genreIds.join('|');
  }

  if (filters.formatFilter === 'liveAction') {
    params.without_genres = String(TMDB_ANIMATION_GENRE_ID);
  }

  const runtimeCap = filters.underTwoHours
    ? 120
    : filters.maxRuntime !== null
      ? filters.maxRuntime
      : null;

  if (runtimeCap !== null) {
    params['with_runtime.lte'] = String(runtimeCap);
  }

  if (filters.indieFocus) {
    params.without_companies = MAJOR_STUDIO_IDS.join('|');
  }

  const withoutKeywords: number[] = [];

  if (filters.excludeSequels) {
    withoutKeywords.push(TMDB_KEYWORDS.sequel);
  }

  if (filters.excludeFranchise) {
    withoutKeywords.push(TMDB_KEYWORDS.sequel, TMDB_KEYWORDS.prequel);
  }

  if (withoutKeywords.length > 0) {
    params.without_keywords = [...new Set(withoutKeywords)].join('|');
  }

  if (filters.watchProviderIds.length > 0) {
    params.watch_region = filters.watchRegion;
    params.with_watch_providers = filters.watchProviderIds.join('|');
    if (filters.watchMonetizationTypes.length > 0) {
      params.with_watch_monetization_types = filters.watchMonetizationTypes.join('|');
    }
  }

  return params;
}

const OSCAR_KEYWORD_IDS = new Set<number>([
  TMDB_KEYWORDS.oscarWinner,
  TMDB_KEYWORDS.oscarNominee,
]);

function isWithinOscarExcludeWindow(movie: Movie, years: number): boolean {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - years);
  cutoff.setHours(0, 0, 0, 0);
  const release = movie.releaseDate
    ? new Date(movie.releaseDate)
    : new Date(movie.year, 11, 31);
  return release >= cutoff;
}

async function fetchMovieKeywordIds(movieId: string): Promise<number[]> {
  const data = await tmdbFetch<{ keywords?: { id: number }[] }>(`/movie/${movieId}/keywords`);
  return data.keywords?.map((keyword) => keyword.id) ?? [];
}

function hasOscarKeyword(keywordIds: number[]): boolean {
  return keywordIds.some((id) => OSCAR_KEYWORD_IDS.has(id));
}

async function applyPostFetchFilters(
  movies: Movie[],
  filters: TmdbBrowseFilters,
  excludeIds: Set<string>
): Promise<Movie[]> {
  let filtered = movies.filter((movie) => !excludeIds.has(movie.id));

  const needsOscarFilter = filters.excludeOscarNomineesAndWinners;
  const needsBudgetFilter = filters.maxBudgetMillions !== null && filters.maxBudgetMillions > 0;
  const needsCollectionFilter = filters.excludeFranchise;

  if (!needsOscarFilter && !needsBudgetFilter && !needsCollectionFilter) {
    return filtered;
  }

  const detailIds = new Set<string>();
  const keywordIds = new Set<string>();

  for (const movie of filtered) {
    if (needsBudgetFilter || needsCollectionFilter) {
      detailIds.add(movie.id);
    }
    if (needsOscarFilter && isWithinOscarExcludeWindow(movie, filters.oscarExcludeYears)) {
      keywordIds.add(movie.id);
    }
  }

  const [details, keywordEntries] = await Promise.all([
    Promise.all(
      [...detailIds].map((movieId) => fetchMovieDetails(movieId).catch(() => null))
    ),
    Promise.all(
      [...keywordIds].map(async (movieId) => {
        const ids = await fetchMovieKeywordIds(movieId).catch(() => []);
        return [movieId, ids] as const;
      })
    ),
  ]);

  const enrichedById = new Map(
    details.filter((movie): movie is Movie => movie !== null).map((movie) => [movie.id, movie])
  );
  const keywordsById = new Map(keywordEntries);

  filtered = filtered
    .map((movie) => enrichedById.get(movie.id) ?? movie)
    .filter((movie) => {
      if (needsCollectionFilter && movie.inCollection) return false;
      if (needsBudgetFilter && movie.budget && movie.budget > 0) {
        const maxBudget = filters.maxBudgetMillions! * 1_000_000;
        if (movie.budget > maxBudget) return false;
      }
      if (
        needsOscarFilter &&
        isWithinOscarExcludeWindow(movie, filters.oscarExcludeYears) &&
        hasOscarKeyword(keywordsById.get(movie.id) ?? [])
      ) {
        return false;
      }
      return true;
    });

  return filtered;
}

export async function fetchDiscoverBrowse(
  filters: TmdbBrowseFilters,
  excludeIds: Set<string>
): Promise<DiscoverBrowseResult> {
  const params = buildDiscoverParams(filters);
  const data = await tmdbFetch<TmdbDiscoverResponse>('/discover/movie', params);

  let movies = data.results.map(mapListItem);
  movies = await applyPostFetchFilters(movies, filters, excludeIds);

  return {
    movies,
    page: data.page,
    totalPages: data.total_pages,
    totalResults: data.total_results,
  };
}

export interface WatchProvider {
  id: number;
  name: string;
  logoPath?: string;
}

interface TmdbWatchProviderEntry {
  provider_id: number;
  provider_name: string;
  logo_path?: string | null;
  display_priority: number;
}

interface TmdbWatchProvidersResponse {
  results: TmdbWatchProviderEntry[];
}

export async function fetchWatchProviders(region: string): Promise<WatchProvider[]> {
  const data = await tmdbFetch<TmdbWatchProvidersResponse>('/watch/providers/movie', {
    watch_region: region.toUpperCase(),
  });

  return data.results
    .sort((a, b) => a.display_priority - b.display_priority)
    .map((provider) => ({
      id: provider.provider_id,
      name: provider.provider_name,
      logoPath: provider.logo_path
        ? `https://image.tmdb.org/t/p/w45${provider.logo_path}`
        : undefined,
    }));
}

async function fetchSimilarMovies(movieId: string): Promise<Movie[]> {
  const data = await tmdbFetch<TmdbListResponse>(`/movie/${movieId}/recommendations`);
  return data.results.slice(0, 6).map(mapListItem);
}

export async function fetchRecommendationCandidates(
  ratings: Rating[],
  cachedMovies: Movie[],
  userId: UserId,
  otherUserId?: UserId
): Promise<Movie[]> {
  const profile = calculateTasteProfile(ratings, cachedMovies, userId);
  const ratedIds = new Set(
    ratings.filter((r) => r.userId === userId).map((r) => r.movieId)
  );

  const topGenreIds = Object.entries(profile.genrePrefs)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .flatMap(([name]) => genreNamesToIds([name]));

  const discoverMovies = await fetchDiscoverMovies(topGenreIds, ratedIds);

  const userRatings = ratings
    .filter((r) => r.userId === userId && r.seen)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 2);

  const similarBatches = await Promise.all(
    userRatings.map((rating) => fetchSimilarMovies(rating.movieId))
  );

  const merged = new Map<string, Movie>();
  for (const movie of [...discoverMovies, ...similarBatches.flat()]) {
    if (!ratedIds.has(movie.id)) {
      merged.set(movie.id, movie);
    }
  }

  if (otherUserId) {
    const otherRatedIds = new Set(
      ratings.filter((r) => r.userId === otherUserId).map((r) => r.movieId)
    );
    for (const id of otherRatedIds) {
      merged.delete(id);
    }
  }

  return Array.from(merged.values());
}
