import { NextRequest, NextResponse } from 'next/server';
import { validateAuthOrInternal } from '@/lib/auth';
import { getExecution } from '@/lib/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { id } = await params;
  const execution = getExecution(id);
  if (!execution) {
    return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
  }
  return NextResponse.json({ api_version: 'v2', execution });
}

