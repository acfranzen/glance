import { NextRequest, NextResponse } from 'next/server';

// Prevent static generation - this route requires runtime database access
export const dynamic = 'force-dynamic';
import { nanoid } from 'nanoid';
import { validateAuthOrInternal } from '@/lib/auth';
import { getAllWidgets, createWidget, getWidget } from '@/lib/db';
import type { CreateWidgetRequest, Widget } from '@/types/api';

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

// GET /api/widgets/instances - List all widget instances
export async function GET(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const rows = getAllWidgets();
    const widgets: Widget[] = rows.map((row, index) => {
      const position = JSON.parse(row.position);
      // Parse mobile position, or generate default if not set
      let mobilePosition = row.mobile_position ? JSON.parse(row.mobile_position) : undefined;
      if (!mobilePosition) {
        // Default mobile layout: 2-col grid, stacked vertically
        mobilePosition = {
          x: 0,
          y: index * 2,
          w: 2,
          h: Math.max(position.h, 2),
        };
      }
      return {
        id: row.id,
        type: row.type,
        title: row.title,
        config: JSON.parse(row.config),
        position,
        mobilePosition,
        data_source: row.data_source ? JSON.parse(row.data_source) : undefined,
        custom_widget_id: (row as { custom_widget_id?: string }).custom_widget_id || undefined,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    });

    return NextResponse.json({ widgets });
  } catch (error) {
    console.error('Failed to fetch widget instances:', error);
    return NextResponse.json(
      { error: 'Failed to fetch widget instances' },
      { status: 500 }
    );
  }
}

// POST /api/widgets/instances - Create a widget instance
export async function POST(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body: CreateWidgetRequest = await request.json();

    if (!body.type) {
      return NextResponse.json(
        { error: 'Widget type is required' },
        { status: 400 }
      );
    }

    // For custom widgets, custom_widget_id is required
    if (body.type === 'custom' && !body.custom_widget_id) {
      return NextResponse.json(
        { error: 'custom_widget_id is required for custom widget type' },
        { status: 400 }
      );
    }

    const id = nanoid();
    const title = body.title || body.type.charAt(0).toUpperCase() + body.type.slice(1);
    const config = body.config || {};
    const defaultSize = DEFAULT_SIZES[body.type] || { w: 3, h: 2 };

    // Calculate position for new widget (place at bottom)
    const existingWidgets = getAllWidgets();
    let maxY = 0;
    for (const w of existingWidgets) {
      const pos = JSON.parse(w.position);
      if (pos.y + pos.h > maxY) {
        maxY = pos.y + pos.h;
      }
    }

    const position = body.position || {
      x: 0,
      y: maxY,
      w: defaultSize.w,
      h: defaultSize.h,
    };

    createWidget(id, body.type, title, config, position, body.data_source, body.custom_widget_id);

    const created = getWidget(id);
    if (!created) {
      throw new Error('Failed to create widget instance');
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
    console.error('Failed to create widget instance:', error);
    return NextResponse.json(
      { error: 'Failed to create widget instance' },
      { status: 500 }
    );
  }
}
