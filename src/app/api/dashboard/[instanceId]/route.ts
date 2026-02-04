import { NextRequest, NextResponse } from 'next/server';

// Prevent static generation - this route requires runtime database access
export const dynamic = 'force-dynamic';

import { validateAuthOrInternal } from '@/lib/auth';
import { getWidget, updateWidget, deleteWidget } from '@/lib/db';

interface UpdateDashboardWidgetRequest {
  title?: string;
  position?: { x: number; y: number; w: number; h: number };
  config?: Record<string, unknown>;
}

// PATCH /api/dashboard/:instanceId - Update widget position/title
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { instanceId } = await params;
    const body: UpdateDashboardWidgetRequest = await request.json();

    // Get existing widget
    const existing = getWidget(instanceId);
    if (!existing) {
      return NextResponse.json(
        { error: `Widget instance "${instanceId}" not found` },
        { status: 404 }
      );
    }

    // Merge updates with existing values
    const title = body.title ?? existing.title;
    const config = body.config ?? JSON.parse(existing.config);
    const position = body.position ?? JSON.parse(existing.position);
    const dataSource = existing.data_source ? JSON.parse(existing.data_source) : undefined;

    updateWidget(instanceId, title, config, position, dataSource);

    const updated = getWidget(instanceId);
    if (!updated) {
      throw new Error('Failed to update widget instance');
    }

    return NextResponse.json({
      id: updated.id,
      type: updated.type,
      title: updated.title,
      position: JSON.parse(updated.position),
      config: JSON.parse(updated.config),
      custom_widget_id: (updated as { custom_widget_id?: string }).custom_widget_id || undefined,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
    });
  } catch (error) {
    console.error('Failed to update widget:', error);
    return NextResponse.json(
      { error: 'Failed to update widget' },
      { status: 500 }
    );
  }
}

// DELETE /api/dashboard/:instanceId - Remove widget from grid
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { instanceId } = await params;

    // Check if widget exists
    const existing = getWidget(instanceId);
    if (!existing) {
      return NextResponse.json(
        { error: `Widget instance "${instanceId}" not found` },
        { status: 404 }
      );
    }

    deleteWidget(instanceId);

    return NextResponse.json({ success: true, deleted: instanceId });
  } catch (error) {
    console.error('Failed to delete widget:', error);
    return NextResponse.json(
      { error: 'Failed to delete widget' },
      { status: 500 }
    );
  }
}
