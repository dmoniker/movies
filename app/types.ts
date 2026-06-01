export interface Movie {
  id: string;
  title: string;
  year: number;
  genres: string[];
  genreIds?: number[];
  director: string;
  actors: string[];
  poster?: string;
  description?: string;
  /** TMDB list/detail metadata for browse mode */
  voteAverage?: number;
  voteCount?: number;
  releaseDate?: string;
  runtime?: number;
  budget?: number;
  revenue?: number;
  inCollection?: boolean;
  imdbId?: string;
}

export interface Rating {
  movieId: string;
  userId: 'darcy' | 'wife';
  rating: number; // 1-10, 0 when unrated
  seen: boolean;
  wantToSee?: boolean;
  notes?: string;
  dateRated: string;
}

export interface TasteProfile {
  userId: 'darcy' | 'wife';
  genrePrefs: Record<string, number>; // 0-1 normalized preference
  actorPrefs: Record<string, number>;
  directorPrefs: Record<string, number>;
  decadePrefs: Record<string, number>;
  avgRating: number;
  totalRated: number;
}

export interface Recommendation {
  movie: Movie;
  score: number;
  reason: string;
  forBoth?: boolean;
}

export type UserId = 'darcy' | 'wife';

export interface DismissedRecommendation {
  movieId: string;
  userId: UserId;
  title: string;
  tags: string[];
  note?: string;
  dateDismissed: string;
}
