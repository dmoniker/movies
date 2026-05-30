export interface Movie {
  id: string;
  title: string;
  year: number;
  genres: string[];
  director: string;
  actors: string[];
  poster?: string;
  description?: string;
}

export interface Rating {
  movieId: string;
  userId: 'darcy' | 'wife';
  rating: number; // 1-10
  seen: boolean;
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
