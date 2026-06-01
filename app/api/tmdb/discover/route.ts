import { NextRequest, NextResponse } from 'next/server';
import { fetchDiscoverBrowse } from '@/lib/tmdb';
import { DEFAULT_BROWSE_FILTERS, type TmdbBrowseFilters } from '@/app/tmdb-browse';

function parseFilters(body: unknown): TmdbBrowseFilters {
  const input = (body && typeof body === 'object' ? body : {}) as Partial<TmdbBrowseFilters>;
  return {
    ...DEFAULT_BROWSE_FILTERS,
    ...input,
    genreIds: Array.isArray(input.genreIds)
      ? input.genreIds.filter((id): id is number => typeof id === 'number')
      : DEFAULT_BROWSE_FILTERS.genreIds,
    page: typeof input.page === 'number' && input.page > 0 ? input.page : 1,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const filters = parseFilters(body.filters);
    const excludeIds = new Set<string>(
      Array.isArray(body.excludeIds)
        ? body.excludeIds.filter((id: unknown): id is string => typeof id === 'string')
        : []
    );

    const result = await fetchDiscoverBrowse(filters, excludeIds);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to discover movies' },
      { status: 500 }
    );
  }
}
