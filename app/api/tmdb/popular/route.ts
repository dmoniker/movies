import { NextRequest, NextResponse } from 'next/server';
import { fetchPopularMovies } from '@/lib/tmdb';

export async function GET(request: NextRequest) {
  try {
    const page = Number(request.nextUrl.searchParams.get('page') ?? '1');
    const movies = await fetchPopularMovies(Number.isFinite(page) ? page : 1);
    return NextResponse.json(movies);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load popular movies' },
      { status: 500 }
    );
  }
}
