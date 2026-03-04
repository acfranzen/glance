import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { validateAuthOrInternal } from '@/lib/auth';
import { getAllWidgets, createWidget, getWidget, getCustomWidget } from '@/lib/db';
import type { CreateWidgetRequest, Widget } from '@/types/api';
import { contractErrorResponse } from '@/lib/api-errors';
import { validateStoredWidgetPayload } from '@/lib/widget-contract';
import { validateWidgetCreateGate } from '@/platform/contracts/contract-gates';
import { enforceWriteGuards } from '@/lib/request-guards';

// Default sizes for widget types
const DEFAULT_SIZES: Record<string, { w: number; h: number }> = {
  clock: { w: 3, h: 2 },
  weather: { w: 3, h: 2 },
  notes: { w: 4, h: 3 },
  bookmarks: { w: 3, h: 3 },
  stat_card: { w: 2, h: 2 },
  markdown: { w: 4, h: 3 },
  line_chart: { w: 6, h: 3 },
  bar_chart: { w: 6, h: 3 },
  list: { w: 4, h: 4 },
  table: { w: 6, h: 4 },
  github_prs: { w: 4, h: 3 },
  calendar_agenda: { w: 4, h: 3 },
  anthropic_usage: { w: 3, h: 3 },
  openai_usage: { w: 3, h: 3 },
};

// GET /api/widgets - List all widgets
export async function GET(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const rows = getAllWidgets();
    const widgets: Widget[] = [];
    const invalid_widgets: Array<{ id: string; issues: ReturnType<typeof validateStoredWidgetPayload>['issues'] }> = [];

    for (const row of rows) {
      try {
        const payload = {
          type: row.type,
          title: row.title,
          config: JSON.parse(row.config),
          position: JSON.parse(row.position),
          data_source: row.data_source ? JSON.parse(row.data_source) : undefined,
          custom_widget_id: (row as { custom_widget_id?: string }).custom_widget_id || undefined,
        };

        const result = validateStoredWidgetPayload(payload);
        if (!result.ok) {
          invalid_widgets.push({ id: row.id, issues: result.issues });
          continue;
        }

        widgets.push({
          id: row.id,
          type: row.type,
          title: row.title,
          config: payload.config,
          position: payload.position,
          data_source: payload.data_source,
          custom_widget_id: payload.custom_widget_id,
          created_at: row.created_at,
          updated_at: row.updated_at,
        });
      } catch {
        invalid_widgets.push({
          id: row.id,
          issues: [{ path: '$', code: 'invalid_json', message: 'Stored widget JSON could not be parsed' }],
        });
      }
    }

    return NextResponse.json({ widgets, invalid_widgets });
  } catch (error) {
    console.error('Failed to fetch widgets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch widgets' },
      { status: 500 }
    );
  }
}

// POST /api/widgets - Create a widget
export async function POST(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const guardResponse = enforceWriteGuards(request, { maxBytes: 64 * 1024, rateLimit: 120 });
  if (guardResponse) {
    return guardResponse;
  }

  try {
    const body: CreateWidgetRequest = await request.json();
    const gate = validateWidgetCreateGate(body);
    if (!gate.ok || !gate.value) {
      return contractErrorResponse(
        gate.failure?.code || 'VALIDATION_ERROR',
        gate.failure?.message || 'Invalid widget create payload',
        gate.failure?.details || []
      );
    }

    const payload = gate.value;

    if (payload.type === 'custom' && payload.custom_widget_id) {
      const customWidget = getCustomWidget(payload.custom_widget_id);
      if (!customWidget || !customWidget.enabled) {
        return NextResponse.json(
          { error: { code: 'INVALID_REFERENCE', message: 'custom_widget_id does not refer to an enabled custom widget' } },
          { status: 422 }
        );
      }
    }

    const id = nanoid();
    const title = payload.title;
    const config = payload.config;
    const defaultSize = DEFAULT_SIZES[payload.type] || { w: 3, h: 2 };

    // Calculate position for new widget (place at bottom)
    const existingWidgets = getAllWidgets();
    let maxY = 0;
    for (const w of existingWidgets) {
      const pos = JSON.parse(w.position);
      if (pos.y + pos.h > maxY) {
        maxY = pos.y + pos.h;
      }
    }

    const position = payload.position || {
      x: 0,
      y: maxY,
      w: defaultSize.w,
      h: defaultSize.h,
    };

    createWidget(id, payload.type, title, config, position, payload.data_source, payload.custom_widget_id);

    const created = getWidget(id);
    if (!created) {
      throw new Error('Failed to create widget');
    }

    const widget: Widget = {
      id: created.id,
      type: created.type,
      title: created.title,
      config: JSON.parse(created.config),
      position: JSON.parse(created.position),
      data_source: created.data_source ? JSON.parse(created.data_source) : undefined,
      custom_widget_id: (created as { custom_widget_id?: string }).custom_widget_id || undefined,
      created_at: created.created_at,
      updated_at: created.updated_at,
    };

    return NextResponse.json(widget, { status: 201 });
  } catch (error) {
    console.error('Failed to create widget:', error);
    return NextResponse.json(
      { error: 'Failed to create widget' },
      { status: 500 }
    );
  }
}
