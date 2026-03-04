import { NextRequest, NextResponse } from 'next/server';
import { validateAuthOrInternal } from '@/lib/auth';
import { listExecutions } from '@/lib/db';

export async function GET(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const workspace_id = request.nextUrl.searchParams.get('workspace_id') || undefined;
  const limitRaw = request.nextUrl.searchParams.get('limit');
  const parsedLimit = limitRaw ? Number(limitRaw) : undefined;
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : undefined;

  const executions = listExecutions({ workspace_id, limit });
  return NextResponse.json({ api_version: 'v2', executions });
}

