import { NextRequest, NextResponse } from 'next/server';
import { validateAuthOrInternal } from '@/lib/auth';
import { getArtifact, getDefaultWorkspace } from '@/lib/db';
import { enforceWriteGuards } from '@/lib/request-guards';
import { contractErrorResponse } from '@/lib/api-errors';
import { validatePackInstallGate } from '@/platform/contracts/contract-gates';
import type { ArtifactManifestPayload } from '@/platform/contracts/platform-contract';

function asManifest(manifest: Record<string, unknown>): ArtifactManifestPayload {
  return manifest as unknown as ArtifactManifestPayload;
}

export async function POST(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const guardResponse = enforceWriteGuards(request, { maxBytes: 32 * 1024, rateLimit: 50 });
  if (guardResponse) {
    return guardResponse;
  }

  try {
    const body = await request.json();
    const gate = validatePackInstallGate(body);
    if (!gate.ok || !gate.value) {
      return contractErrorResponse(
        gate.failure?.code || 'VALIDATION_ERROR',
        gate.failure?.message || 'Invalid pack install payload',
        gate.failure?.details || []
      );
    }

    const artifact = getArtifact(gate.value.artifact_id);
    if (!artifact) {
      return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    }

    const targetWorkspaceId = gate.value.workspace_id || getDefaultWorkspace().id;
    const manifest = asManifest(artifact.manifest);

    return NextResponse.json({
      api_version: 'v2',
      install_preview: {
        artifact_id: artifact.id,
        target_workspace_id: targetWorkspaceId,
        runtime_profile: manifest.runtime_profile,
        trust_level: manifest.trust_level || 'community',
        required_secrets: manifest.required_secrets || [],
        external_domains: manifest.egress_domains || [],
      },
      status: 'scaffolded',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to install pack' },
      { status: 500 }
    );
  }
}

