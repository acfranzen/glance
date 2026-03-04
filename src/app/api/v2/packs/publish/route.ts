import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { validateAuthOrInternal } from '@/lib/auth';
import { createArtifact, getDefaultWorkspace } from '@/lib/db';
import { enforceWriteGuards } from '@/lib/request-guards';
import { contractErrorResponse } from '@/lib/api-errors';
import { validateArtifactCreateGate } from '@/platform/contracts/contract-gates';

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
    const gate = validateArtifactCreateGate({
      ...body,
      type: 'widget-pack',
    });
    if (!gate.ok || !gate.value) {
      return contractErrorResponse(
        gate.failure?.code || 'VALIDATION_ERROR',
        gate.failure?.message || 'Invalid pack payload',
        gate.failure?.details || []
      );
    }

    const defaultWorkspace = getDefaultWorkspace();
    const artifactId = `art_${nanoid(12)}`;

    createArtifact({
      id: artifactId,
      workspace_id: gate.value.workspace_id || defaultWorkspace.id,
      type: 'widget-pack',
      title: gate.value.title,
      manifest: gate.value.manifest as unknown as Record<string, unknown>,
      metadata: gate.value.metadata || {},
    });

    return NextResponse.json(
      {
        api_version: 'v2',
        pack: {
          artifact_id: artifactId,
          trust_level: gate.value.manifest.trust_level || 'community',
          runtime_profile: gate.value.manifest.runtime_profile,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to publish pack' },
      { status: 500 }
    );
  }
}

