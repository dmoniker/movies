import { NextRequest, NextResponse } from 'next/server';
import { fetchWatchProviders } from '@/lib/tmdb';

export async function GET(request: NextRequest) {
  try {
    const region = request.nextUrl.searchParams.get('region') ?? 'US';
    const providers = await fetchWatchProviders(region);
    return NextResponse.json(providers);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load watch providers' },
      { status: 500 }
    );
  }
}
