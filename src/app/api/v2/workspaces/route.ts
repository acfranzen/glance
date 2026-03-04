import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { validateAuthOrInternal } from '@/lib/auth';
import { createWorkspace, getWorkspaceBySlug, listWorkspaces } from '@/lib/db';
import { enforceWriteGuards } from '@/lib/request-guards';
import { contractErrorResponse } from '@/lib/api-errors';
import { validateWorkspaceCreateGate } from '@/platform/contracts/contract-gates';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export async function GET(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  return NextResponse.json({
    api_version: 'v2',
    workspaces: listWorkspaces(),
  });
}

export async function POST(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const guardResponse = enforceWriteGuards(request, { maxBytes: 32 * 1024, rateLimit: 20 });
  if (guardResponse) {
    return guardResponse;
  }

  try {
    const body = await request.json();
    const gate = validateWorkspaceCreateGate(body);
    if (!gate.ok || !gate.value) {
      return contractErrorResponse(
        gate.failure?.code || 'VALIDATION_ERROR',
        gate.failure?.message || 'Invalid workspace create payload',
        gate.failure?.details || []
      );
    }

    let slug = gate.value.slug || slugify(gate.value.name);
    if (!slug) {
      slug = `workspace-${nanoid(6).toLowerCase()}`;
    }
    if (getWorkspaceBySlug(slug)) {
      slug = `${slug}-${nanoid(4).toLowerCase()}`;
    }

    const id = `ws_${nanoid(10)}`;
    createWorkspace({
      id,
      name: gate.value.name,
      slug,
      is_default: false,
    });

    return NextResponse.json(
      {
        api_version: 'v2',
        workspace: {
          id,
          name: gate.value.name,
          slug,
          is_default: false,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create workspace' },
      { status: 500 }
    );
  }
}

