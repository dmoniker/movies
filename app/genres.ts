export const TMDB_GENRE_MAP: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
};

export function genreIdsToNames(genreIds: number[]): string[] {
  return genreIds
    .map((id) => TMDB_GENRE_MAP[id])
    .filter((name): name is string => Boolean(name));
}

export function genreNamesToIds(names: string[]): number[] {
  const byName = Object.fromEntries(
    Object.entries(TMDB_GENRE_MAP).map(([id, name]) => [name, Number(id)])
  );
  return names.map((name) => byName[name]).filter((id): id is number => Boolean(id));
}
