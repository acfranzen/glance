import { NextRequest, NextResponse } from 'next/server';

// Prevent static generation - this route requires runtime database access
export const dynamic = 'force-dynamic';
import { validateAuthOrInternal } from '@/lib/auth';
import { getWidget, updateWidget, deleteWidget } from '@/lib/db';
import type { UpdateWidgetRequest, Widget } from '@/types/api';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/widgets/instances/:id - Get a single widget instance
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
        { error: 'Widget instance not found' },
        { status: 404 }
      );
    }

    const widget: Widget = {
      id: row.id,
      type: row.type,
      title: row.title,
      config: JSON.parse(row.config),
      position: JSON.parse(row.position),
      data_source: row.data_source ? JSON.parse(row.data_source) : undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    return NextResponse.json(widget);
  } catch (error) {
    console.error('Failed to fetch widget instance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch widget instance' },
      { status: 500 }
    );
  }
}

// PATCH /api/widgets/instances/:id - Update a widget instance
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { id } = await params;

  try {
    const existing = getWidget(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Widget instance not found' },
        { status: 404 }
      );
    }

    const body: UpdateWidgetRequest = await request.json();

    const title = body.title ?? existing.title;
    const config = body.config ?? JSON.parse(existing.config);
    const position = body.position ?? JSON.parse(existing.position);
    const dataSource = body.data_source ?? (existing.data_source ? JSON.parse(existing.data_source) : undefined);

    updateWidget(id, title, config, position, dataSource);

    const updated = getWidget(id);
    if (!updated) {
      throw new Error('Failed to update widget instance');
    }

    const widget: Widget = {
      id: updated.id,
      type: updated.type,
      title: updated.title,
      config: JSON.parse(updated.config),
      position: JSON.parse(updated.position),
      data_source: updated.data_source ? JSON.parse(updated.data_source) : undefined,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
    };

    return NextResponse.json(widget);
  } catch (error) {
    console.error('Failed to update widget instance:', error);
    return NextResponse.json(
      { error: 'Failed to update widget instance' },
      { status: 500 }
    );
  }
}

// DELETE /api/widgets/instances/:id - Delete a widget instance
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
        { error: 'Widget instance not found' },
        { status: 404 }
      );
    }

    deleteWidget(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete widget instance:', error);
    return NextResponse.json(
      { error: 'Failed to delete widget instance' },
      { status: 500 }
    );
  }
}
