import { NextRequest, NextResponse } from 'next/server';
import { fetchMovieDetails } from '@/lib/tmdb';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const movie = await fetchMovieDetails(id);
    return NextResponse.json(movie);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load movie' },
      { status: 500 }
    );
  }
}
