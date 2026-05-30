import { NextRequest, NextResponse } from 'next/server';
import { fetchRecommendationCandidates } from '@/lib/tmdb';
import { Movie, Rating, UserId } from '@/app/types';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      ratings?: Rating[];
      cachedMovies?: Movie[];
      userId?: UserId;
      otherUserId?: UserId;
    };

    const ratings = body.ratings ?? [];
    const cachedMovies = body.cachedMovies ?? [];
    const userId = body.userId ?? 'darcy';
    const movies = await fetchRecommendationCandidates(
      ratings,
      cachedMovies,
      userId,
      body.otherUserId
    );
    return NextResponse.json(movies);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load recommendations' },
      { status: 500 }
    );
  }
}
