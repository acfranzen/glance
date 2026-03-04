import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { validateAuthOrInternal } from '@/lib/auth';
import { createExecution, completeExecution, getCustomWidget, getCustomWidgetBySlug, getDefaultWorkspace } from '@/lib/db';
import { hasCredential, type Provider } from '@/lib/credentials';
import { validateServerCode } from '@/lib/widget-sdk/server-executor';
import { validateStoredCustomWidgetPayload } from '@/lib/widget-contract';
import { inferRequiredCredentialProviders } from '@/platform/contracts/custom-widget-semantic';
import { LegacyRuntimeExecutionAdapter } from '@/platform/runtime/legacy-runtime-adapter';
import { sanitizeErrorMessage, sanitizeForLog } from '@/lib/security';
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

// POST /api/custom-widgets/[slug]/execute - Execute server-side code for a widget
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const guardResponse = enforceWriteGuards(request, { maxBytes: 256 * 1024, rateLimit: 45 });
  if (guardResponse) {
    return guardResponse;
  }

  try {
    const { slug } = await context.params;
    const widget = findCustomWidget(slug);

    if (!widget) {
      return NextResponse.json(
        { error: 'Custom widget not found' },
        { status: 404 }
      );
    }

    const contractValidation = validateStoredCustomWidgetPayload(widget);
    if (!contractValidation.ok) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_STORED_WIDGET',
            message: 'Stored custom widget does not satisfy contract',
            details: contractValidation.issues,
          },
        },
        { status: 422 }
      );
    }

    // Check if server code is enabled
    if (!widget.server_code_enabled) {
      return NextResponse.json(
        { error: 'Server code is not enabled for this widget' },
        { status: 400 }
      );
    }

    // Check if server code exists
    if (!widget.server_code) {
      return NextResponse.json(
        { error: 'No server code defined for this widget' },
        { status: 400 }
      );
    }

    // Parse request body for params
    let params: Record<string, unknown> = {};
    try {
      const body = await request.json();
      params = body.params || {};
    } catch {
      // No body or invalid JSON - use empty params
    }

    // Validate the server code patterns
    const validation = validateServerCode(widget.server_code);
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Invalid server code: ${validation.error}` },
        { status: 400 }
      );
    }

    const requiredProviders = inferRequiredCredentialProviders(widget)
      .filter((provider): provider is Provider => ['anthropic', 'openai', 'vercel', 'github', 'openweather'].includes(provider));
    const missingProviders = requiredProviders.filter((provider) => !hasCredential(provider));
    if (missingProviders.length > 0) {
      return NextResponse.json(
        {
          error: 'Missing required credentials',
          missing_credentials: missingProviders,
        },
        { status: 422 }
      );
    }

    const workspace = getDefaultWorkspace();
    const executionId = `exec_${nanoid(12)}`;

    createExecution({
      execution_id: executionId,
      workspace_id: workspace.id,
      actor: 'api',
      target_type: 'custom-widget-server-code',
      target_id: widget.id,
      status: 'running',
      input: params,
    });

    const engine = new LegacyRuntimeExecutionAdapter(widget.server_code);
    const result = await engine.execute({
      actor: 'api',
      target: {
        type: 'custom-widget-server-code',
        id: widget.id,
        workspace_id: workspace.id,
      },
      input: params,
      timeout_ms: 5000,
    });

    completeExecution({
      execution_id: executionId,
      status: result.status,
      output: result.output,
      finished_at: result.finished_at,
      cost_hint: result.cost_hint ?? null,
      error: result.error ?? null,
    });

    if (result.status === 'failed') {
      return NextResponse.json(
        { error: result.error || 'Execution failed', execution_id: executionId },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: result.output, execution_id: executionId });
  } catch (error) {
    console.error('Failed to execute server code:', sanitizeForLog(error));
    return NextResponse.json(
      { error: sanitizeErrorMessage(error) || 'Failed to execute server code' },
      { status: 500 }
    );
  }
}
