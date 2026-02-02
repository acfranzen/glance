import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { validateAuthOrInternal } from '@/lib/auth';
import {
  getAllCustomWidgets,
  getCustomWidgetBySlug,
  createCustomWidget,
  getCustomWidget
} from '@/lib/db';
import { validateServerCode } from '@/lib/widget-sdk/server-executor';

// Helper to slugify a name
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// GET /api/custom-widgets - List all custom widget definitions
export async function GET(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const includeDisabled = request.nextUrl.searchParams.get('include_disabled') === 'true';
    const customWidgets = getAllCustomWidgets(includeDisabled);

    return NextResponse.json({ custom_widgets: customWidgets });
  } catch (error) {
    console.error('Failed to fetch custom widgets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch custom widgets' },
      { status: 500 }
    );
  }
}

// POST /api/custom-widgets - Create a new custom widget definition
export async function POST(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    if (!body.source_code || typeof body.source_code !== 'string') {
      return NextResponse.json(
        { error: 'Source code is required' },
        { status: 400 }
      );
    }

    // Generate or validate slug
    let slug = body.slug || slugify(body.name);
    
    // Check if slug already exists
    const existing = getCustomWidgetBySlug(slug);
    if (existing) {
      // Append a random suffix
      slug = `${slug}-${nanoid(6)}`;
    }

    // Parse and validate sizes
    const defaultSize = body.default_size || { w: 4, h: 3 };
    const minSize = body.min_size || { w: 2, h: 2 };

    if (typeof defaultSize.w !== 'number' || typeof defaultSize.h !== 'number') {
      return NextResponse.json(
        { error: 'default_size must have numeric w and h properties' },
        { status: 400 }
      );
    }

    if (typeof minSize.w !== 'number' || typeof minSize.h !== 'number') {
      return NextResponse.json(
        { error: 'min_size must have numeric w and h properties' },
        { status: 400 }
      );
    }

    // Parse data providers
    const dataProviders = Array.isArray(body.data_providers) 
      ? body.data_providers.filter((p: unknown) => typeof p === 'string')
      : [];

    // Parse refresh interval
    const refreshInterval = typeof body.refresh_interval === 'number'
      ? body.refresh_interval
      : 300;

    // Parse server code fields
    const serverCode = typeof body.server_code === 'string' ? body.server_code : null;
    const serverCodeEnabled = body.server_code_enabled === true;

    // Validate server code if provided and enabled
    if (serverCode && serverCodeEnabled) {
      const validation = validateServerCode(serverCode);
      if (!validation.valid) {
        return NextResponse.json(
          { error: `Invalid server code: ${validation.error}` },
          { status: 400 }
        );
      }
    }

    // Generate ID
    const id = `cw_${nanoid(12)}`;

    // Create the custom widget
    createCustomWidget(
      id,
      body.name,
      slug,
      body.description || null,
      body.source_code,
      null, // compiled_code will be generated client-side
      defaultSize,
      minSize,
      dataProviders,
      refreshInterval,
      true, // enabled by default
      serverCode,
      serverCodeEnabled
    );

    // Fetch and return the created widget
    const created = getCustomWidget(id);
    if (!created) {
      throw new Error('Failed to create custom widget');
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Failed to create custom widget:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create custom widget' },
      { status: 500 }
    );
  }
}
