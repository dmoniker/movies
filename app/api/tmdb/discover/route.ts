import { NextRequest, NextResponse } from 'next/server';
import { fetchDiscoverBrowse } from '@/lib/tmdb';
import { DEFAULT_BROWSE_FILTERS, type TmdbBrowseFilters, type WatchMonetizationType } from '@/app/tmdb-browse';

const VALID_MONETIZATION: WatchMonetizationType[] = ['flatrate', 'free', 'ads', 'rent', 'buy'];

function parseFilters(body: unknown): TmdbBrowseFilters {
  const input = (body && typeof body === 'object' ? body : {}) as Partial<TmdbBrowseFilters>;
  return {
    ...DEFAULT_BROWSE_FILTERS,
    ...input,
    genreIds: Array.isArray(input.genreIds)
      ? input.genreIds.filter((id): id is number => typeof id === 'number')
      : DEFAULT_BROWSE_FILTERS.genreIds,
    watchProviderIds: Array.isArray(input.watchProviderIds)
      ? input.watchProviderIds.filter((id): id is number => typeof id === 'number')
      : DEFAULT_BROWSE_FILTERS.watchProviderIds,
    watchRegion:
      typeof input.watchRegion === 'string' && input.watchRegion.length === 2
        ? input.watchRegion.toUpperCase()
        : DEFAULT_BROWSE_FILTERS.watchRegion,
    watchMonetizationTypes: Array.isArray(input.watchMonetizationTypes)
      ? input.watchMonetizationTypes.filter((type): type is WatchMonetizationType =>
          VALID_MONETIZATION.includes(type as WatchMonetizationType)
        )
      : DEFAULT_BROWSE_FILTERS.watchMonetizationTypes,
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
