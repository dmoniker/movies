export interface ApiConfig {
  tmdb: boolean;
}

export function getApiConfig(): ApiConfig {
  return {
    tmdb: Boolean(process.env.TMDB_API_KEY?.trim()),
  };
}

export function getTmdbApiKey(): string {
  const key = process.env.TMDB_API_KEY?.trim();
  if (!key) {
    throw new Error(
      'Missing TMDB_API_KEY. Add it to .env.local — get a free key at https://www.themoviedb.org/settings/api'
    );
  }
  return key;
}
