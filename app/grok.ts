import { Movie, Rating, Recommendation, TasteProfile, UserId, DismissedRecommendation } from './types';
import { loadGrokCacheEntry, saveGrokCacheEntry } from './storage';
import { apiFetch } from './api-client';

interface GrokRerankInput {
  ratings: Rating[];
  movies: Movie[];
  profile: TasteProfile;
  otherProfile?: TasteProfile;
  userId: UserId;
  otherUserId?: UserId;
  candidates: Recommendation[];
  mode: 'personal' | 'shared';
  dismissals: DismissedRecommendation[];
  avoidanceRules: string[];
}

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function buildGrokCacheKey(
  mode: 'personal' | 'shared',
  userId: UserId,
  otherUserId: UserId | undefined,
  ratings: Rating[],
  candidateIds: string[],
  dismissals: DismissedRecommendation[] = []
): string {
  const ratingSig = [...ratings]
    .sort((a, b) => `${a.userId}:${a.movieId}`.localeCompare(`${b.userId}:${b.movieId}`))
    .map((r) => `${r.userId}:${r.movieId}:${r.rating}:${r.seen}:${r.wantToSee ?? false}:${r.notes ?? ''}`)
    .join('|');
  const dismissSig = [...dismissals]
    .sort((a, b) => `${a.userId}:${a.movieId}`.localeCompare(`${b.userId}:${b.movieId}`))
    .map((d) => `${d.userId}:${d.movieId}:${d.tags.join(',')}:${d.note ?? ''}`)
    .join('|');
  const candidatesSig = [...candidateIds].sort().join(',');
  return hashString(`${mode}:${userId}:${otherUserId ?? ''}:${ratingSig}:${dismissSig}:${candidatesSig}`);
}

export async function rerankWithGrok(input: GrokRerankInput): Promise<Recommendation[] | null> {
  if (input.candidates.length === 0) {
    return null;
  }

  const cacheKey = buildGrokCacheKey(
    input.mode,
    input.userId,
    input.otherUserId,
    input.ratings,
    input.candidates.map((c) => c.movie.id),
    input.dismissals
  );

  const cached = loadGrokCacheEntry(cacheKey);
  if (cached) {
    return cached;
  }

  const { recommendations } = await apiFetch<{ recommendations: Recommendation[] }>('/grok/rerank', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!recommendations.length) {
    return null;
  }

  saveGrokCacheEntry(cacheKey, recommendations);
  return recommendations;
}
