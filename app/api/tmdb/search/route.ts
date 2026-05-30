import { NextRequest, NextResponse } from 'next/server';
import { searchCatalog, type SearchMode } from '@/lib/tmdb';

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get('query') ?? '';
    const mode = (request.nextUrl.searchParams.get('mode') ?? 'title') as SearchMode;
    const result = await searchCatalog(query, mode);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    );
  }
}
