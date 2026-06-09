import { NextRequest, NextResponse } from 'next/server';
import { fetchMovieTrailerYouTubeKey } from '@/lib/tmdb';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const youtubeKey = await fetchMovieTrailerYouTubeKey(id);
    return NextResponse.json({ youtubeKey });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load trailer' },
      { status: 500 }
    );
  }
}
