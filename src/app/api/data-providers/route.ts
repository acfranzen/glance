import { NextRequest, NextResponse } from 'next/server';

// Prevent static generation - this route requires runtime database access
export const dynamic = 'force-dynamic';
import { nanoid } from 'nanoid';
import { validateAuthOrInternal } from '@/lib/auth';
import { 
  getAllDataProviders, 
  getDataProviderBySlug,
  createDataProvider,
  getDataProvider,
  type DataProvider
} from '@/lib/db';

// Helper to slugify a name
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// GET /api/data-providers - List all data providers
export async function GET(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const providers = getAllDataProviders();
    return NextResponse.json({ data_providers: providers });
  } catch (error) {
    console.error('Failed to fetch data providers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data providers' },
      { status: 500 }
    );
  }
}

// POST /api/data-providers - Create a new data provider
export async function POST(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!body.base_url || typeof body.base_url !== 'string') {
      return NextResponse.json({ error: 'Base URL is required' }, { status: 400 });
    }

    // Validate base_url is a valid URL
    try {
      new URL(body.base_url);
    } catch {
      return NextResponse.json({ error: 'Invalid base URL' }, { status: 400 });
    }

    // Generate or validate slug
    let slug = body.slug || slugify(body.name);
    
    // Check if slug already exists
    const existing = getDataProviderBySlug(slug);
    if (existing) {
      slug = `${slug}-${nanoid(6)}`;
    }

    // Validate auth_type
    const validAuthTypes = ['bearer', 'basic', 'header', 'none'];
    const authType = body.auth_type || 'bearer';
    if (!validAuthTypes.includes(authType)) {
      return NextResponse.json(
        { error: `Invalid auth_type. Must be one of: ${validAuthTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Parse default_headers
    const defaultHeaders = typeof body.default_headers === 'object' && body.default_headers !== null
      ? body.default_headers
      : {};

    // Generate ID
    const id = `dp_${nanoid(12)}`;

    // Create the data provider
    createDataProvider(
      id,
      body.name,
      slug,
      body.base_url,
      authType as DataProvider['auth_type'],
      body.credential_id || null,
      defaultHeaders
    );

    // Fetch and return the created provider
    const created = getDataProvider(id);
    if (!created) {
      throw new Error('Failed to create data provider');
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Failed to create data provider:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create data provider' },
      { status: 500 }
    );
  }
}
