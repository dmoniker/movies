import { Movie, Rating, Recommendation, TasteProfile, UserId, DismissedRecommendation } from '@/app/types';
import { getXaiApiKey } from '@/lib/env';

const XAI_API_URL = 'https://api.x.ai/v1/responses';
const GROK_MODEL = 'grok-4.3';
const CANDIDATE_LIMIT = 30;
const RESULT_LIMIT = 12;

const RERANK_SCHEMA = {
  type: 'object',
  properties: {
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          movieId: { type: 'string', description: 'TMDB movie id from the candidate list' },
          score: { type: 'number', description: 'Match score from 0 to 10' },
          reason: { type: 'string', description: 'One personalized sentence explaining why' },
          forBoth: { type: 'boolean', description: 'True if both users would enjoy this' },
        },
        required: ['movieId', 'score', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['recommendations'],
  additionalProperties: false,
} as const;

export interface GrokRerankInput {
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

interface GrokRerankItem {
  movieId: string;
  score: number;
  reason: string;
  forBoth?: boolean;
}

function movieTitle(movies: Movie[], movieId: string): string {
  return movies.find((m) => m.id === movieId)?.title ?? `Movie ${movieId}`;
}

function buildRatedList(
  ratings: Rating[],
  movies: Movie[],
  userId: UserId,
  minRating?: number,
  maxRating?: number
): string[] {
  return ratings
    .filter((r) => {
      if (r.userId !== userId || !r.seen) return false;
      if (minRating !== undefined && r.rating < minRating) return false;
      if (maxRating !== undefined && r.rating > maxRating) return false;
      return true;
    })
    .sort((a, b) => b.rating - a.rating)
    .map((r) => {
      const title = movieTitle(movies, r.movieId);
      const note = r.notes?.trim() ? ` — note: "${r.notes.trim()}"` : '';
      return `${title} (${r.rating}/10)${note}`;
    });
}

function buildPrompt(input: GrokRerankInput): { system: string; user: string } {
  const {
    profile,
    otherProfile,
    userId,
    otherUserId,
    candidates,
    mode,
    movies,
    ratings,
    dismissals,
    avoidanceRules,
  } = input;
  const userLabel = userId === 'darcy' ? 'Darcy' : 'Wife';
  const otherLabel = otherUserId === 'darcy' ? 'Darcy' : 'Wife';

  const loved = buildRatedList(ratings, movies, userId, 8);
  const disliked = buildRatedList(ratings, movies, userId, undefined, 4);

  const candidateLines = candidates.slice(0, CANDIDATE_LIMIT).map((c) => {
    const desc = c.movie.description?.slice(0, 120) ?? '';
    return `- id:${c.movie.id} | ${c.movie.title} (${c.movie.year}) | ${c.movie.genres.join(', ')} | heuristic:${c.score} | ${desc}`;
  });

  const system =
    mode === 'shared'
      ? `You are a movie recommendation curator for a couple choosing date-night films. Pick the best matches from ONLY the candidate list. Reference their actual ratings when explaining picks. Strictly avoid picks that match their rejection rules or recently dismissed films. Return exactly up to ${RESULT_LIMIT} recommendations, ranked best first. Use only movieId values from the candidates.`
      : `You are a personalized movie recommender. Pick the best matches from ONLY the candidate list. Reference the user's actual ratings and taste when explaining picks. Strictly avoid picks that match their rejection rules or recently dismissed films. Return exactly up to ${RESULT_LIMIT} recommendations, ranked best first. Use only movieId values from the candidates.`;

  let userPrompt = `${userLabel}'s taste profile:
- Average rating: ${profile.avgRating}/10 across ${profile.totalRated} seen films
- Top genres: ${Object.entries(profile.genrePrefs)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([g, v]) => `${g} (${Math.round(v * 100)}%)`)
    .join(', ') || 'none yet'}
- Loved (8+): ${loved.slice(0, 8).join('; ') || 'none yet'}
- Disliked (4 or below): ${disliked.slice(0, 6).join('; ') || 'none yet'}`;

  if (mode === 'shared' && otherProfile && otherUserId) {
    const otherLoved = buildRatedList(ratings, movies, otherUserId, 8);
    const otherDisliked = buildRatedList(ratings, movies, otherUserId, undefined, 4);
    userPrompt += `

${otherLabel}'s taste profile:
- Average rating: ${otherProfile.avgRating}/10 across ${otherProfile.totalRated} seen films
- Top genres: ${Object.entries(otherProfile.genrePrefs)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([g, v]) => `${g} (${Math.round(v * 100)}%)`)
      .join(', ') || 'none yet'}
- Loved (8+): ${otherLoved.slice(0, 8).join('; ') || 'none yet'}
- Disliked (4 or below): ${otherDisliked.slice(0, 6).join('; ') || 'none yet'}

Pick films both would enjoy. Set forBoth true only for strong shared picks.`;
  }

  if (avoidanceRules.length > 0) {
    userPrompt += `

Hard avoidance rules (do NOT recommend films that fit these — treat as deal-breakers):
${avoidanceRules.map((r) => `- ${r}`).join('\n')}`;
  }

  const recentDismissals = dismissals
    .filter((d) => d.tags.length > 0 || d.note)
    .slice(-8);
  if (recentDismissals.length > 0) {
    userPrompt += `

Recently dismissed recommendations (avoid similar):
${recentDismissals.map((d) => `- ${d.title}: ${[...d.tags, d.note].filter(Boolean).join('; ')}`).join('\n')}`;
  }

  userPrompt += `

Candidates (pick from these only):
${candidateLines.join('\n')}`;

  return { system, user: userPrompt };
}

function extractOutputText(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;

  if (typeof record.output_text === 'string') {
    return record.output_text;
  }

  const output = record.output;
  if (!Array.isArray(output)) return null;

  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    if (entry.type !== 'message' || !Array.isArray(entry.content)) continue;
    for (const part of entry.content) {
      if (!part || typeof part !== 'object') continue;
      const content = part as Record<string, unknown>;
      if (content.type === 'output_text' && typeof content.text === 'string') {
        return content.text;
      }
    }
  }

  return null;
}

function mergeGrokResults(
  items: GrokRerankItem[],
  candidates: Recommendation[]
): Recommendation[] {
  const byId = new Map(candidates.map((c) => [c.movie.id, c]));
  const merged: Recommendation[] = [];

  for (const item of items) {
    const base = byId.get(item.movieId);
    if (!base) continue;
    merged.push({
      movie: base.movie,
      score: Math.min(Math.max(Math.round(item.score * 10) / 10, 0), 10),
      reason: item.reason.trim() || base.reason,
      forBoth: item.forBoth ?? base.forBoth,
    });
  }

  if (merged.length >= RESULT_LIMIT) {
    return merged.slice(0, RESULT_LIMIT);
  }

  const used = new Set(merged.map((r) => r.movie.id));
  for (const candidate of candidates) {
    if (merged.length >= RESULT_LIMIT) break;
    if (used.has(candidate.movie.id)) continue;
    merged.push(candidate);
  }

  return merged;
}

async function callGrokApi(system: string, user: string): Promise<GrokRerankItem[]> {
  const apiKey = getXaiApiKey();
  const response = await fetch(XAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROK_MODEL,
      store: false,
      input: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'movie_recommendations',
          schema: RERANK_SCHEMA,
          strict: true,
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(body || `xAI request failed (${response.status})`);
  }

  const data = await response.json();
  const text = extractOutputText(data);
  if (!text) {
    throw new Error('No structured output from xAI');
  }

  const parsed = JSON.parse(text) as { recommendations?: GrokRerankItem[] };
  if (!Array.isArray(parsed.recommendations)) {
    throw new Error('Invalid recommendation format from xAI');
  }

  return parsed.recommendations;
}

export async function rerankWithGrokServer(input: GrokRerankInput): Promise<Recommendation[]> {
  if (input.candidates.length === 0) {
    return [];
  }

  const { system, user } = buildPrompt(input);
  const items = await callGrokApi(system, user);
  return mergeGrokResults(items, input.candidates);
}
