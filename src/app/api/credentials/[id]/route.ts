import { NextRequest, NextResponse } from 'next/server';
import { validateAuthOrInternal } from '@/lib/auth';
import {
  getCredentialById,
  updateCredential,
  deleteCredential,
  validateCredential,
  Provider,
} from '@/lib/credentials';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/credentials/:id - Get credential details (without value)
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { id } = await params;
  const credential = getCredentialById(id);

  if (!credential) {
    return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
  }

  return NextResponse.json(credential);
}

// PUT /api/credentials/:id - Update a credential
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { name, value, metadata, skipValidation } = body;

    if (!name || !value) {
      return NextResponse.json(
        { error: 'Missing required fields: name, value' },
        { status: 400 }
      );
    }

    const existing = getCredentialById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
    }

    // Validate the new credential value
    if (!skipValidation) {
      const validation = await validateCredential(existing.provider as Provider, value);
      if (!validation.valid) {
        return NextResponse.json(
          { error: `Credential validation failed: ${validation.error}` },
          { status: 400 }
        );
      }
    }

    const updated = updateCredential(id, name, value, metadata || existing.metadata);
    if (!updated) {
      return NextResponse.json({ error: 'Failed to update credential' }, { status: 500 });
    }

    const credential = getCredentialById(id);
    return NextResponse.json({
      success: true,
      credential,
    });
  } catch (error) {
    console.error('Failed to update credential:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update credential' },
      { status: 500 }
    );
  }
}

// DELETE /api/credentials/:id - Delete a credential
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { id } = await params;

  const deleted = deleteCredential(id);
  if (!deleted) {
    return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
