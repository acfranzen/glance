import { NextRequest, NextResponse } from 'next/server';
import { validateAuthOrInternal } from '@/lib/auth';
import { getWidget, updateWidget, deleteWidget } from '@/lib/db';
import type { UpdateWidgetRequest, Widget } from '@/types/api';
import { contractErrorResponse } from '@/lib/api-errors';
import { validateStoredWidgetPayload } from '@/lib/widget-contract';
import { validateWidgetUpdateGate } from '@/platform/contracts/contract-gates';
import { enforceWriteGuards } from '@/lib/request-guards';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/widgets/:id - Get a single widget
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { id } = await params;

  try {
    const row = getWidget(id);
    if (!row) {
      return NextResponse.json(
        { error: 'Widget not found' },
        { status: 404 }
      );
    }

    const payload = {
      type: row.type,
      title: row.title,
      config: JSON.parse(row.config),
      position: JSON.parse(row.position),
      data_source: row.data_source ? JSON.parse(row.data_source) : undefined,
      custom_widget_id: (row as { custom_widget_id?: string }).custom_widget_id || undefined,
    };
    const validation = validateStoredWidgetPayload(payload);
    if (!validation.ok) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_STORED_WIDGET',
            message: 'Stored widget does not satisfy contract',
            details: validation.issues,
          },
        },
        { status: 422 }
      );
    }

    const widget: Widget = {
      id: row.id,
      type: row.type,
      title: row.title,
      config: payload.config,
      position: payload.position,
      data_source: payload.data_source,
      custom_widget_id: payload.custom_widget_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    return NextResponse.json(widget);
  } catch (error) {
    console.error('Failed to fetch widget:', error);
    return NextResponse.json(
      { error: 'Failed to fetch widget' },
      { status: 500 }
    );
  }
}

// PATCH /api/widgets/:id - Update a widget
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const guardResponse = enforceWriteGuards(request, { maxBytes: 64 * 1024, rateLimit: 120 });
  if (guardResponse) {
    return guardResponse;
  }

  const { id } = await params;

  try {
    const existing = getWidget(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Widget not found' },
        { status: 404 }
      );
    }

    const body: UpdateWidgetRequest = await request.json();
    const gate = validateWidgetUpdateGate(body);
    if (!gate.ok || !gate.value) {
      return contractErrorResponse(
        gate.failure?.code || 'VALIDATION_ERROR',
        gate.failure?.message || 'Invalid widget update payload',
        gate.failure?.details || []
      );
    }

    const updates = gate.value;

    const title = updates.title ?? existing.title;
    const config = updates.config ?? JSON.parse(existing.config);
    const position = updates.position ?? JSON.parse(existing.position);
    const dataSource = updates.data_source ?? (existing.data_source ? JSON.parse(existing.data_source) : undefined);

    updateWidget(id, title, config, position, dataSource);

    const updated = getWidget(id);
    if (!updated) {
      throw new Error('Failed to update widget');
    }

    const payload = {
      type: updated.type,
      title: updated.title,
      config: JSON.parse(updated.config),
      position: JSON.parse(updated.position),
      data_source: updated.data_source ? JSON.parse(updated.data_source) : undefined,
      custom_widget_id: (updated as { custom_widget_id?: string }).custom_widget_id || undefined,
    };
    const storedValidation = validateStoredWidgetPayload(payload);
    if (!storedValidation.ok) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_STORED_WIDGET',
            message: 'Updated widget does not satisfy contract',
            details: storedValidation.issues,
          },
        },
        { status: 422 }
      );
    }

    const widget: Widget = {
      id: updated.id,
      type: updated.type,
      title: updated.title,
      config: payload.config,
      position: payload.position,
      data_source: payload.data_source,
      custom_widget_id: payload.custom_widget_id,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
    };

    return NextResponse.json(widget);
  } catch (error) {
    console.error('Failed to update widget:', error);
    return NextResponse.json(
      { error: 'Failed to update widget' },
      { status: 500 }
    );
  }
}

// DELETE /api/widgets/:id - Delete a widget
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { id } = await params;

  try {
    const existing = getWidget(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Widget not found' },
        { status: 404 }
      );
    }

    deleteWidget(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete widget:', error);
    return NextResponse.json(
      { error: 'Failed to delete widget' },
      { status: 500 }
    );
  }
}
