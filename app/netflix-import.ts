import { Movie } from './types';

export interface NetflixMovieCandidate {
  netflixTitle: string;
  searchTitle: string;
  year?: number;
  watchedAt?: string;
}

export interface NetflixParseStats {
  skippedTv: number;
  skippedShort: number;
  skippedSupplemental: number;
}

export interface NetflixImportProgress {
  current: number;
  total: number;
}

export interface NetflixImportSummary {
  matched: number;
  alreadySeen: number;
  unmatched: string[];
  stats: NetflixParseStats;
}

const MIN_WATCH_SECONDS = 120;
const MATCH_SCORE_THRESHOLD = 70;
const SEARCH_DELAY_MS = 150;

function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];

    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || (ch === '\r' && content[i + 1] === '\n')) {
      row.push(cell);
      if (row.some((value) => value.trim())) {
        rows.push(row);
      }
      row = [];
      cell = '';
      if (ch === '\r') i++;
    } else if (ch !== '\r') {
      cell += ch;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim())) {
      rows.push(row);
    }
  }

  return rows;
}

function columnIndex(header: string[], ...names: string[]): number {
  const normalized = header.map((col) => col.trim().toLowerCase());
  for (const name of names) {
    const index = normalized.indexOf(name.toLowerCase());
    if (index >= 0) return index;
  }
  return -1;
}

function parseDurationSeconds(duration: string): number | null {
  const trimmed = duration.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(':').map((part) => Number.parseInt(part, 10));
  if (parts.length === 3 && parts.every((part) => Number.isFinite(part))) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  const asNumber = Number(trimmed);
  return Number.isFinite(asNumber) ? asNumber : null;
}

function parseWatchDate(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return undefined;
}

function isLikelyTvEpisode(title: string): boolean {
  const parts = title.split(':').map((part) => part.trim());
  if (parts.length <= 1) return false;

  const second = parts[1].toLowerCase();
  const tvIndicators = [
    'season',
    'part ',
    'part:',
    'chapter',
    'episode',
    'limited series',
    'collection',
    'volume',
    'miniseries',
  ];

  return tvIndicators.some((indicator) => second.includes(indicator));
}

function parseNetflixTitle(title: string): { searchTitle: string; year?: number } {
  const trimmed = title.trim();
  const yearMatch = trimmed.match(/\((\d{4})\)\s*$/);
  if (yearMatch) {
    return {
      searchTitle: trimmed.replace(/\(\d{4}\)\s*$/, '').trim(),
      year: Number.parseInt(yearMatch[1], 10),
    };
  }
  return { searchTitle: trimmed };
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function scoreNetflixMatch(candidate: NetflixMovieCandidate, movie: Movie): number {
  const search = normalizeTitle(candidate.searchTitle);
  const result = normalizeTitle(movie.title);

  if (!search || !result) return 0;

  if (search === result) {
    let score = 100;
    if (candidate.year && Math.abs(movie.year - candidate.year) <= 1) score += 20;
    return score;
  }

  if (result.startsWith(search) || search.startsWith(result)) {
    let score = 75;
    if (candidate.year && Math.abs(movie.year - candidate.year) <= 1) score += 15;
    return score;
  }

  if (result.includes(search) || search.includes(result)) {
    let score = 55;
    if (candidate.year && Math.abs(movie.year - candidate.year) <= 1) score += 10;
    return score;
  }

  return 0;
}

export function pickBestNetflixMatch(
  candidate: NetflixMovieCandidate,
  movies: Movie[]
): Movie | null {
  let best: Movie | null = null;
  let bestScore = 0;

  for (const movie of movies) {
    const score = scoreNetflixMatch(candidate, movie);
    if (score > bestScore) {
      bestScore = score;
      best = movie;
    }
  }

  return bestScore >= MATCH_SCORE_THRESHOLD ? best : null;
}

export function extractNetflixMovies(content: string): {
  movies: NetflixMovieCandidate[];
  stats: NetflixParseStats;
} {
  const trimmed = content.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    throw new Error('Netflix CSV file is empty');
  }

  const rows = parseCsvRows(trimmed);
  if (rows.length === 0) {
    throw new Error('Netflix CSV file is empty');
  }

  const stats: NetflixParseStats = {
    skippedTv: 0,
    skippedShort: 0,
    skippedSupplemental: 0,
  };

  const header = rows[0].map((col) => col.trim());
  const titleIndex = columnIndex(header, 'title');
  const hasHeader = titleIndex >= 0;
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const titleCol = hasHeader ? titleIndex : 0;
  const dateCol = hasHeader ? columnIndex(header, 'start time', 'date') : 1;
  const durationCol = hasHeader ? columnIndex(header, 'duration') : -1;
  const supplementalCol = hasHeader ? columnIndex(header, 'supplemental video type') : -1;

  const byTitle = new Map<string, NetflixMovieCandidate>();

  for (const row of dataRows) {
    const rawTitle = row[titleCol]?.trim();
    if (!rawTitle) continue;

    if (supplementalCol >= 0) {
      const supplemental = row[supplementalCol]?.trim();
      if (supplemental && supplemental.toLowerCase() !== 'n/a') {
        stats.skippedSupplemental++;
        continue;
      }
    }

    if (durationCol >= 0) {
      const duration = parseDurationSeconds(row[durationCol] ?? '');
      if (duration !== null && duration < MIN_WATCH_SECONDS) {
        stats.skippedShort++;
        continue;
      }
    }

    if (isLikelyTvEpisode(rawTitle)) {
      stats.skippedTv++;
      continue;
    }

    const { searchTitle, year } = parseNetflixTitle(rawTitle);
    const watchedAt = dateCol >= 0 ? parseWatchDate(row[dateCol] ?? '') : undefined;
    const existing = byTitle.get(searchTitle);

    if (!existing) {
      byTitle.set(searchTitle, {
        netflixTitle: rawTitle,
        searchTitle,
        year,
        watchedAt,
      });
      continue;
    }

    if (watchedAt && (!existing.watchedAt || watchedAt > existing.watchedAt)) {
      byTitle.set(searchTitle, {
        netflixTitle: rawTitle,
        searchTitle,
        year: year ?? existing.year,
        watchedAt,
      });
    }
  }

  const movies = [...byTitle.values()].sort((a, b) => a.searchTitle.localeCompare(b.searchTitle));

  if (movies.length === 0 && stats.skippedTv === 0 && stats.skippedShort === 0) {
    throw new Error(
      'No movie titles found. Use Netflix Account → Viewing activity → Download all, or your full data export CSV.'
    );
  }

  return { movies, stats };
}

export async function importNetflixMovies(
  candidates: NetflixMovieCandidate[],
  options: {
    searchMovies: (query: string) => Promise<Movie[]>;
    isAlreadySeen: (movieId: string) => boolean;
    onProgress?: (progress: NetflixImportProgress) => void;
  }
): Promise<{
  matched: Array<{ candidate: NetflixMovieCandidate; movie: Movie }>;
  alreadySeen: string[];
  unmatched: string[];
}> {
  const matched: Array<{ candidate: NetflixMovieCandidate; movie: Movie }> = [];
  const alreadySeen: string[] = [];
  const unmatched: string[] = [];

  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index];
    options.onProgress?.({ current: index + 1, total: candidates.length });

    try {
      const results = await options.searchMovies(candidate.searchTitle);
      const movie = pickBestNetflixMatch(candidate, results);
      if (!movie) {
        unmatched.push(candidate.netflixTitle);
        continue;
      }

      if (options.isAlreadySeen(movie.id)) {
        alreadySeen.push(candidate.netflixTitle);
        continue;
      }

      matched.push({ candidate, movie });
    } catch {
      unmatched.push(candidate.netflixTitle);
    }

    if (index < candidates.length - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, SEARCH_DELAY_MS));
    }
  }

  return { matched, alreadySeen, unmatched };
}

export function formatNetflixImportSummary(
  summary: NetflixImportSummary,
  profileLabel: string
): string {
  const lines = [
    `Netflix import complete for ${profileLabel}.`,
    `• ${summary.matched} movies marked as seen`,
    `• ${summary.alreadySeen} already in your library`,
    `• ${summary.unmatched.length} titles could not be matched on TMDB`,
  ];

  if (summary.stats.skippedTv > 0) {
    lines.push(`• ${summary.stats.skippedTv} TV episodes skipped`);
  }
  if (summary.stats.skippedShort > 0) {
    lines.push(`• ${summary.stats.skippedShort} short views skipped`);
  }
  if (summary.stats.skippedSupplemental > 0) {
    lines.push(`• ${summary.stats.skippedSupplemental} trailers/extras skipped`);
  }

  if (summary.unmatched.length > 0) {
    const preview = summary.unmatched.slice(0, 5).join('\n  - ');
    lines.push('', 'Unmatched titles (sample):', `  - ${preview}`);
    if (summary.unmatched.length > 5) {
      lines.push(`  …and ${summary.unmatched.length - 5} more`);
    }
  }

  return lines.join('\n');
}
