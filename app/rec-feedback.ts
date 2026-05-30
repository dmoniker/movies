import { DismissedRecommendation, UserId } from './types';

export const DISMISS_TAGS = [
  'Formulaic',
  'Message over plot',
  'Not my genres',
  'Too mainstream',
  'Too artsy / slow',
  'Too violent / dark',
  'Too lightweight',
  'Franchise fatigue',
  'Weak acting',
  'Bad reviews',
  'Already seen similar',
  'Not interested',
] as const;

export type DismissTag = (typeof DISMISS_TAGS)[number];

export function buildRulesFromDismissals(dismissals: DismissedRecommendation[]): string[] {
  const rules = new Set<string>();
  for (const dismissal of dismissals) {
    for (const tag of dismissal.tags) {
      rules.add(tag);
    }
    if (dismissal.note?.trim()) {
      rules.add(dismissal.note.trim());
    }
  }
  return Array.from(rules);
}

export function dismissalsForUser(
  dismissals: DismissedRecommendation[],
  userId: UserId
): DismissedRecommendation[] {
  return dismissals.filter((d) => d.userId === userId);
}

export function isDismissed(
  dismissals: DismissedRecommendation[],
  movieId: string,
  userIds: UserId[]
): boolean {
  return dismissals.some((d) => d.movieId === movieId && userIds.includes(d.userId));
}
