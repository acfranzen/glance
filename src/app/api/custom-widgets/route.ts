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
import { contractErrorResponse } from '@/lib/api-errors';
import { validateStoredCustomWidgetPayload } from '@/lib/widget-contract';
import { validateCustomWidgetCreateGate } from '@/platform/contracts/contract-gates';
import { inferRequiredCredentialProviders } from '@/platform/contracts/custom-widget-semantic';
import { enforceWriteGuards } from '@/lib/request-guards';

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
    const rows = getAllCustomWidgets(includeDisabled);
    const customWidgets = [];
    const invalid_custom_widgets: Array<{ id: string; issues: ReturnType<typeof validateStoredCustomWidgetPayload>['issues'] }> = [];

    for (const row of rows) {
      const validation = validateStoredCustomWidgetPayload(row);
      if (!validation.ok) {
        invalid_custom_widgets.push({ id: row.id, issues: validation.issues });
        continue;
      }
      customWidgets.push({
        ...row,
        required_credentials_effective: inferRequiredCredentialProviders(row),
      });
    }

    return NextResponse.json({ custom_widgets: customWidgets, invalid_custom_widgets });
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
  const guardResponse = enforceWriteGuards(request, { maxBytes: 512 * 1024, rateLimit: 30 });
  if (guardResponse) {
    return guardResponse;
  }

  try {
    const body = await request.json();
    const gate = validateCustomWidgetCreateGate(body);
    if (!gate.ok || !gate.value) {
      return contractErrorResponse(
        gate.failure?.code || 'VALIDATION_ERROR',
        gate.failure?.message || 'Invalid custom widget create payload',
        gate.failure?.details || []
      );
    }
    const payload = gate.value;

    // Generate or validate slug
    let slug = payload.slug || slugify(payload.name);
    
    // Check if slug already exists
    const existing = getCustomWidgetBySlug(slug);
    if (existing) {
      // Append a random suffix
      slug = `${slug}-${nanoid(6)}`;
    }

    const defaultSize = payload.default_size || { w: 4, h: 3 };
    const minSize = payload.min_size || { w: 2, h: 2 };

    // Parse data providers
    const dataProviders = payload.data_providers || [];

    // Parse refresh interval
    const refreshInterval = typeof payload.refresh_interval === 'number' ? payload.refresh_interval : 300;
    const runtimeProfile = payload.runtime_profile || (dataProviders.length > 0 ? 'networked' : 'safe');

    // Parse server code fields
    const serverCode = typeof payload.server_code === 'string' ? payload.server_code : null;
    const serverCodeEnabled = payload.server_code_enabled === true;

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
      payload.name,
      slug,
      payload.description || null,
      payload.source_code,
      payload.compiled_code || null,
      defaultSize,
      minSize,
      dataProviders,
      refreshInterval,
      payload.enabled !== undefined ? payload.enabled : true,
      serverCode,
      serverCodeEnabled,
      payload.required_credentials || [],
      runtimeProfile,
      payload.permissions || {}
    );

    // Fetch and return the created widget
    const created = getCustomWidget(id);
    if (!created) {
      throw new Error('Failed to create custom widget');
    }

    const storedValidation = validateStoredCustomWidgetPayload(created);
    if (!storedValidation.ok) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_STORED_WIDGET',
            message: 'Created custom widget does not satisfy contract',
            details: storedValidation.issues,
          },
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        ...created,
        required_credentials_effective: inferRequiredCredentialProviders(created),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to create custom widget:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create custom widget' },
      { status: 500 }
    );
  }
}
