import { NextRequest, NextResponse } from 'next/server';
import { validateAuthOrInternal } from '@/lib/auth';
import { 
  getDataProvider,
  getDataProviderBySlug,
  updateDataProvider,
  deleteDataProvider,
  type DataProvider
} from '@/lib/db';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Helper to find provider by ID or slug
function findDataProvider(idOrSlug: string) {
  // Try by ID first (starts with 'dp_')
  if (idOrSlug.startsWith('dp_')) {
    return getDataProvider(idOrSlug);
  }
  // Try by slug
  return getDataProviderBySlug(idOrSlug);
}

// GET /api/data-providers/[id] - Get a data provider by ID or slug
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const provider = findDataProvider(id);

    if (!provider) {
      return NextResponse.json({ error: 'Data provider not found' }, { status: 404 });
    }

    return NextResponse.json(provider);
  } catch (error) {
    console.error('Failed to fetch data provider:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data provider' },
      { status: 500 }
    );
  }
}

// PATCH /api/data-providers/[id] - Update a data provider
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const existing = findDataProvider(id);

    if (!existing) {
      return NextResponse.json({ error: 'Data provider not found' }, { status: 404 });
    }

    const body = await request.json();

    // Validate base_url if provided
    if (body.base_url) {
      try {
        new URL(body.base_url);
      } catch {
        return NextResponse.json({ error: 'Invalid base URL' }, { status: 400 });
      }
    }

    // Validate auth_type if provided
    if (body.auth_type) {
      const validAuthTypes = ['bearer', 'basic', 'header', 'none'];
      if (!validAuthTypes.includes(body.auth_type)) {
        return NextResponse.json(
          { error: `Invalid auth_type. Must be one of: ${validAuthTypes.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Merge with existing values
    const name = body.name ?? existing.name;
    const baseUrl = body.base_url ?? existing.base_url;
    const authType = (body.auth_type ?? existing.auth_type) as DataProvider['auth_type'];
    const credentialId = body.credential_id !== undefined ? body.credential_id : existing.credential_id;
    const defaultHeaders = body.default_headers !== undefined 
      ? body.default_headers 
      : existing.default_headers;

    // Update the provider
    updateDataProvider(
      existing.id,
      name,
      baseUrl,
      authType,
      credentialId,
      defaultHeaders
    );

    // Fetch and return the updated provider
    const updated = getDataProvider(existing.id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update data provider:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update data provider' },
      { status: 500 }
    );
  }
}

// DELETE /api/data-providers/[id] - Delete a data provider
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const existing = findDataProvider(id);

    if (!existing) {
      return NextResponse.json({ error: 'Data provider not found' }, { status: 404 });
    }

    deleteDataProvider(existing.id);

    return NextResponse.json({ success: true, deleted_id: existing.id });
  } catch (error) {
    console.error('Failed to delete data provider:', error);
    return NextResponse.json(
      { error: 'Failed to delete data provider' },
      { status: 500 }
    );
  }
}
