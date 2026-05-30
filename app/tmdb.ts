import { Movie, Rating, UserId } from './types';
import { apiFetch } from './api-client';

export type SearchMode = 'title' | 'director' | 'all';

export interface SearchResult {
  movies: Movie[];
  matchedDirector?: string;
}

export async function fetchPopularMovies(page = 1): Promise<Movie[]> {
  return apiFetch(`/tmdb/popular?page=${page}`);
}

export async function searchCatalog(query: string, mode: SearchMode = 'title'): Promise<SearchResult> {
  const params = new URLSearchParams({ query, mode });
  return apiFetch(`/tmdb/search?${params}`);
}

/** @deprecated Use searchCatalog */
export async function searchMovies(query: string, mode: SearchMode = 'title'): Promise<Movie[]> {
  const result = await searchCatalog(query, mode);
  return result.movies;
}

export async function enrichMoviesWithDirectors(movies: Movie[], limit = 20): Promise<Movie[]> {
  return apiFetch('/tmdb/enrich', {
    method: 'POST',
    body: JSON.stringify({ movies, limit }),
  });
}

export async function fetchMovieDetails(movieId: string): Promise<Movie> {
  return apiFetch(`/tmdb/movie/${movieId}`);
}

export async function fetchRecommendationCandidates(
  ratings: Rating[],
  cachedMovies: Movie[],
  userId: UserId,
  otherUserId?: UserId
): Promise<Movie[]> {
  return apiFetch('/tmdb/recommendations', {
    method: 'POST',
    body: JSON.stringify({ ratings, cachedMovies, userId, otherUserId }),
  });
}
