import { NextRequest, NextResponse } from 'next/server';

// Prevent static generation - this route requires runtime database access
export const dynamic = 'force-dynamic';

import { nanoid } from 'nanoid';
import { validateAuthOrInternal } from '@/lib/auth';
import {
  getAllWidgets,
  createWidget,
  getWidget,
  getCustomWidgetBySlug,
  getCustomWidget,
} from '@/lib/db';
import { findFirstAvailablePosition, getMaxY } from '@/lib/dashboard/auto-placement';

// Default sizes for widget types (same as widgets/instances)
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
  custom: { w: 4, h: 3 },
};

interface DashboardWidget {
  id: string;
  widget_slug?: string;
  custom_widget_id?: string;
  type: string;
  title: string;
  position: { x: number; y: number; w: number; h: number };
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// GET /api/dashboard - List all widget instances with positions
export async function GET(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const rows = getAllWidgets();
    const widgets: DashboardWidget[] = rows.map((row) => {
      const position = JSON.parse(row.position);
      const customWidgetId = (row as { custom_widget_id?: string }).custom_widget_id;

      return {
        id: row.id,
        type: row.type,
        title: row.title,
        position,
        config: JSON.parse(row.config),
        custom_widget_id: customWidgetId || undefined,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    });

    // Calculate grid info
    const maxY = getMaxY(widgets.map((w) => ({ position: w.position })));

    return NextResponse.json({
      widgets,
      grid: {
        columns: 12,
        rows: maxY,
      },
    });
  } catch (error) {
    console.error('Failed to fetch dashboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard' },
      { status: 500 }
    );
  }
}

interface CreateDashboardWidgetRequest {
  widget?: string;           // Lookup by slug (preferred)
  custom_widget_id?: string; // Lookup by ID
  type?: string;             // Built-in widget type
  title?: string;            // Optional title override
  position?: { x: number; y: number; w: number; h: number };
  config?: Record<string, unknown>;
}

// POST /api/dashboard - Add widget by slug/id with auto-placement
export async function POST(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body: CreateDashboardWidgetRequest = await request.json();

    let widgetType = 'custom';
    let customWidgetId: string | undefined;
    let widgetSlug: string | undefined;
    let defaultSize = DEFAULT_SIZES.custom;
    let title = body.title;

    // Determine the widget source
    if (body.widget) {
      // Lookup by slug
      const customWidget = getCustomWidgetBySlug(body.widget);
      if (!customWidget) {
        return NextResponse.json(
          { error: `Widget with slug "${body.widget}" not found` },
          { status: 404 }
        );
      }
      customWidgetId = customWidget.id;
      widgetSlug = customWidget.slug;
      defaultSize = customWidget.default_size;
      title = title || customWidget.name;
      widgetType = 'custom';
    } else if (body.custom_widget_id) {
      // Lookup by ID
      const customWidget = getCustomWidget(body.custom_widget_id);
      if (!customWidget) {
        return NextResponse.json(
          { error: `Custom widget with ID "${body.custom_widget_id}" not found` },
          { status: 404 }
        );
      }
      customWidgetId = customWidget.id;
      widgetSlug = customWidget.slug;
      defaultSize = customWidget.default_size;
      title = title || customWidget.name;
      widgetType = 'custom';
    } else if (body.type) {
      // Built-in widget type
      widgetType = body.type;
      defaultSize = DEFAULT_SIZES[body.type] || DEFAULT_SIZES.custom;
      title = title || body.type.charAt(0).toUpperCase() + body.type.slice(1).replace(/_/g, ' ');
    } else {
      return NextResponse.json(
        { error: 'Must provide widget (slug), custom_widget_id, or type' },
        { status: 400 }
      );
    }

    // Get existing widgets for placement
    const existingWidgets = getAllWidgets();
    const existingPositions = existingWidgets.map((w) => ({
      position: JSON.parse(w.position) as { x: number; y: number; w: number; h: number },
    }));

    // Determine position - use provided or auto-place
    let position: { x: number; y: number; w: number; h: number };
    let autoPlaced = false;

    if (body.position) {
      position = {
        x: body.position.x,
        y: body.position.y,
        w: body.position.w ?? defaultSize.w,
        h: body.position.h ?? defaultSize.h,
      };
    } else {
      // Auto-place the widget
      position = findFirstAvailablePosition(existingPositions, defaultSize, 12);
      autoPlaced = true;
    }

    // Create the widget
    const id = nanoid();
    const config = body.config || {};

    createWidget(id, widgetType, title!, config, position, undefined, customWidgetId);

    const created = getWidget(id);
    if (!created) {
      throw new Error('Failed to create widget instance');
    }

    const response: DashboardWidget & { auto_placed: boolean; widget_slug?: string } = {
      id: created.id,
      type: created.type,
      title: created.title,
      position: JSON.parse(created.position),
      config: JSON.parse(created.config),
      custom_widget_id: customWidgetId,
      widget_slug: widgetSlug,
      auto_placed: autoPlaced,
      created_at: created.created_at,
      updated_at: created.updated_at,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Failed to add widget to dashboard:', error);
    return NextResponse.json(
      { error: 'Failed to add widget to dashboard' },
      { status: 500 }
    );
  }
}
