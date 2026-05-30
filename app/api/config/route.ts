import { NextResponse } from 'next/server';
import { getApiConfig } from '@/lib/env';

export async function GET() {
  return NextResponse.json(getApiConfig());
}
