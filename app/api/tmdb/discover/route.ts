import { NextRequest, NextResponse } from 'next/server';
import { fetchDiscoverBrowse } from '@/lib/tmdb';
import { mergeBrowseFilters, type TmdbBrowseFilters } from '@/app/tmdb-browse';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const filters = mergeBrowseFilters(
      (body.filters && typeof body.filters === 'object' ? body.filters : {}) as Partial<TmdbBrowseFilters>
    );
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
