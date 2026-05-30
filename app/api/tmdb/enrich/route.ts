import { NextRequest, NextResponse } from 'next/server';
import { enrichMoviesWithDirectors } from '@/lib/tmdb';
import { Movie } from '@/app/types';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { movies?: Movie[]; limit?: number };
    const movies = body.movies ?? [];
    const limit = body.limit ?? 20;
    const enriched = await enrichMoviesWithDirectors(movies, limit);
    return NextResponse.json(enriched);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to enrich movies' },
      { status: 500 }
    );
  }
}
