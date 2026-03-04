import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { validateAuthOrInternal } from '@/lib/auth';
import { createArtifact, getDefaultWorkspace, listArtifacts } from '@/lib/db';
import { enforceWriteGuards } from '@/lib/request-guards';
import { contractErrorResponse } from '@/lib/api-errors';
import { validateArtifactCreateGate } from '@/platform/contracts/contract-gates';

export async function GET(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const workspace_id = request.nextUrl.searchParams.get('workspace_id') || undefined;
  const limitRaw = request.nextUrl.searchParams.get('limit');
  const parsedLimit = limitRaw ? Number(limitRaw) : undefined;
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : undefined;

  return NextResponse.json({
    api_version: 'v2',
    artifacts: listArtifacts({ workspace_id, limit }),
  });
}

export async function POST(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const guardResponse = enforceWriteGuards(request, { maxBytes: 256 * 1024, rateLimit: 30 });
  if (guardResponse) {
    return guardResponse;
  }

  try {
    const body = await request.json();
    const gate = validateArtifactCreateGate(body);
    if (!gate.ok || !gate.value) {
      return contractErrorResponse(
        gate.failure?.code || 'VALIDATION_ERROR',
        gate.failure?.message || 'Invalid artifact payload',
        gate.failure?.details || []
      );
    }

    const defaultWorkspace = getDefaultWorkspace();
    const artifactId = `art_${nanoid(12)}`;
    createArtifact({
      id: artifactId,
      workspace_id: gate.value.workspace_id || defaultWorkspace.id,
      type: gate.value.type || 'widget-pack',
      title: gate.value.title,
      manifest: gate.value.manifest as unknown as Record<string, unknown>,
      metadata: gate.value.metadata || {},
    });

    return NextResponse.json(
      {
        api_version: 'v2',
        artifact_id: artifactId,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create artifact' },
      { status: 500 }
    );
  }
}

