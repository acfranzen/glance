import { NextRequest, NextResponse } from 'next/server';
import { validateAuthOrInternal } from '@/lib/auth';
import {
  getCustomWidget,
  getCustomWidgetBySlug,
  updateCustomWidget,
  deleteCustomWidget
} from '@/lib/db';
import { validateServerCode } from '@/lib/widget-sdk/server-executor';
import { contractErrorResponse } from '@/lib/api-errors';
import { validateStoredCustomWidgetPayload, type CustomWidgetPayload } from '@/lib/widget-contract';
import { validateCustomWidgetUpdateGate } from '@/platform/contracts/contract-gates';
import { inferRequiredCredentialProviders } from '@/platform/contracts/custom-widget-semantic';
import { enforceWriteGuards } from '@/lib/request-guards';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// Helper to find widget by ID or slug
function findCustomWidget(idOrSlug: string) {
  // Try by ID first (starts with 'cw_')
  if (idOrSlug.startsWith('cw_')) {
    return getCustomWidget(idOrSlug);
  }
  // Try by slug
  return getCustomWidgetBySlug(idOrSlug);
}

// GET /api/custom-widgets/[slug] - Get a custom widget by ID or slug
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { slug } = await context.params;
    const customWidget = findCustomWidget(slug);

    if (!customWidget) {
      return NextResponse.json(
        { error: 'Custom widget not found' },
        { status: 404 }
      );
    }

    const validation = validateStoredCustomWidgetPayload(customWidget);
    if (!validation.ok) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_STORED_WIDGET',
            message: 'Stored custom widget does not satisfy contract',
            details: validation.issues,
          },
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      ...customWidget,
      required_credentials_effective: inferRequiredCredentialProviders(customWidget),
    });
  } catch (error) {
    console.error('Failed to fetch custom widget:', error);
    return NextResponse.json(
      { error: 'Failed to fetch custom widget' },
      { status: 500 }
    );
  }
}

// PATCH /api/custom-widgets/[slug] - Update a custom widget
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const guardResponse = enforceWriteGuards(request, { maxBytes: 512 * 1024, rateLimit: 30 });
  if (guardResponse) {
    return guardResponse;
  }

  try {
    const { slug } = await context.params;
    const existing = findCustomWidget(slug);

    if (!existing) {
      return NextResponse.json(
        { error: 'Custom widget not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const existingContract: CustomWidgetPayload = {
      name: existing.name,
      slug: existing.slug,
      description: existing.description,
      source_code: existing.source_code,
      compiled_code: existing.compiled_code,
      default_size: existing.default_size,
      min_size: existing.min_size,
      data_providers: existing.data_providers,
      refresh_interval: existing.refresh_interval,
      enabled: existing.enabled,
      server_code: existing.server_code,
      server_code_enabled: existing.server_code_enabled,
      required_credentials: existing.required_credentials,
      runtime_profile: existing.runtime_profile,
      permissions: existing.permissions,
    };

    const gate = validateCustomWidgetUpdateGate(body, existingContract);
    if (!gate.ok || !gate.value) {
      return contractErrorResponse(
        gate.failure?.code || 'VALIDATION_ERROR',
        gate.failure?.message || 'Invalid custom widget update payload',
        gate.failure?.details || []
      );
    }
    const updates = gate.value;

    // Merge with existing values
    const name = updates.name ?? existing.name;
    const description = updates.description !== undefined ? updates.description : existing.description;
    const sourceCode = updates.source_code ?? existing.source_code;
    const compiledCode = updates.compiled_code !== undefined ? updates.compiled_code : existing.compiled_code;
    const defaultSize = updates.default_size ?? existing.default_size;
    const minSize = updates.min_size ?? existing.min_size;
    const dataProviders = updates.data_providers !== undefined ? updates.data_providers : existing.data_providers;
    const refreshInterval = updates.refresh_interval ?? existing.refresh_interval;
    const enabled = updates.enabled !== undefined ? updates.enabled : existing.enabled;
    const serverCode = updates.server_code !== undefined ? updates.server_code : existing.server_code;
    const serverCodeEnabled =
      updates.server_code_enabled !== undefined ? updates.server_code_enabled : existing.server_code_enabled;
    const requiredCredentials =
      updates.required_credentials !== undefined ? updates.required_credentials : existing.required_credentials;
    const runtimeProfile = updates.runtime_profile !== undefined ? updates.runtime_profile : existing.runtime_profile;
    const permissions = updates.permissions !== undefined ? updates.permissions : existing.permissions;

    const mergedValidation = validateStoredCustomWidgetPayload({
      name,
      slug: existing.slug,
      description,
      source_code: sourceCode,
      compiled_code: compiledCode,
      default_size: defaultSize,
      min_size: minSize,
      data_providers: dataProviders,
      refresh_interval: refreshInterval,
      enabled,
      server_code: serverCode,
      server_code_enabled: serverCodeEnabled,
      required_credentials: requiredCredentials,
      runtime_profile: runtimeProfile,
      permissions,
    });
    if (!mergedValidation.ok) {
      return contractErrorResponse('VALIDATION_ERROR', 'Invalid merged custom widget payload', mergedValidation.issues);
    }

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

    // Update the widget
    updateCustomWidget(
      existing.id,
      name,
      description,
      sourceCode,
      compiledCode,
      defaultSize,
      minSize,
      dataProviders,
      refreshInterval,
      enabled,
      serverCode,
      serverCodeEnabled,
      requiredCredentials || [],
      runtimeProfile || ((dataProviders || []).length > 0 ? 'networked' : 'safe'),
      permissions || {}
    );

    // Fetch and return the updated widget
    const updated = getCustomWidget(existing.id);
    if (!updated) {
      throw new Error('Failed to fetch updated custom widget');
    }

    const storedValidation = validateStoredCustomWidgetPayload(updated);
    if (!storedValidation.ok) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_STORED_WIDGET',
            message: 'Updated custom widget does not satisfy contract',
            details: storedValidation.issues,
          },
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      ...updated,
      required_credentials_effective: inferRequiredCredentialProviders(updated),
    });
  } catch (error) {
    console.error('Failed to update custom widget:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update custom widget' },
      { status: 500 }
    );
  }
}

// DELETE /api/custom-widgets/[slug] - Delete a custom widget
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { slug } = await context.params;
    const existing = findCustomWidget(slug);

    if (!existing) {
      return NextResponse.json(
        { error: 'Custom widget not found' },
        { status: 404 }
      );
    }

    deleteCustomWidget(existing.id);

    return NextResponse.json({ success: true, deleted_id: existing.id });
  } catch (error) {
    console.error('Failed to delete custom widget:', error);
    return NextResponse.json(
      { error: 'Failed to delete custom widget' },
      { status: 500 }
    );
  }
}
