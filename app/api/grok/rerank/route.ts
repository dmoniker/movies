import { NextRequest, NextResponse } from 'next/server';
import { getApiConfig } from '@/lib/env';
import { rerankWithGrokServer, type GrokRerankInput } from '@/lib/grok-rerank';

export async function POST(request: NextRequest) {
  if (!getApiConfig().xai) {
    return NextResponse.json({ error: 'Grok is not configured' }, { status: 503 });
  }

  try {
    const body = (await request.json()) as GrokRerankInput;
    const recommendations = await rerankWithGrokServer(body);
    return NextResponse.json({ recommendations });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Grok rerank failed' },
      { status: 500 }
    );
  }
}
