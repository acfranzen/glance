import { NextRequest, NextResponse } from 'next/server';

// Prevent static generation - this route requires runtime database access
export const dynamic = 'force-dynamic';
import { validateAuthOrInternal } from '@/lib/auth';
import { getWidget, getCustomWidget, updateWidgetData } from '@/lib/db';
import { getWidgetData } from '@/lib/widget-data';
import { CachedData, isStale, parseCachedData } from '@/lib/cache-utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper to get refresh interval for a widget
function getRefreshInterval(widget: { custom_widget_id?: string }): number {
  const defaultInterval = 300; // Default 5 minutes
  
  if (widget.custom_widget_id) {
    const customWidget = getCustomWidget(widget.custom_widget_id);
    if (customWidget) {
      return customWidget.refresh_interval;
    }
  }
  
  return defaultInterval;
}

// Helper to build cache metadata response block
function buildCacheMetadata(
  widget: { data_cache: string | null; data_updated_at: string | null },
  refreshInterval: number
): {
  cached: boolean;
  cachedAt: string | null;
  source: string | null;
  endpoint: string | null;
  stale: boolean;
  refreshInterval: number;
  dataUpdatedAt: string | null;
} {
  const cacheMeta = parseCachedData(widget.data_cache);
  const stale = isStale(widget.data_updated_at, refreshInterval);

  return {
    cached: !!widget.data_cache,
    cachedAt: cacheMeta?.fetchedAt ?? widget.data_updated_at,
    source: cacheMeta?.provider ?? null,
    endpoint: cacheMeta?.endpoint ?? null,
    stale,
    refreshInterval,
    dataUpdatedAt: widget.data_updated_at
  };
}

// GET /api/widgets/:id/data - Get cached widget data with cache metadata
// Returns both raw cache info and bot-parseable widget data
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { id } = await params;

  try {
    const widget = getWidget(id);
    if (!widget) {
      return NextResponse.json(
        { error: 'Widget not found' },
        { status: 404 }
      );
    }

    const refreshInterval = getRefreshInterval(widget as { custom_widget_id?: string });

    // Get the bot-parseable widget data (includes summary, narratives, etc.)
    const widgetData = await getWidgetData(widget);

    // Return combined response with both formats
    return NextResponse.json({
      // Bot-parseable widget data
      ...widgetData,
      
      // Cache metadata
      cache: buildCacheMetadata(widget, refreshInterval)
    });
  } catch (error) {
    console.error('Failed to get widget data:', error);
    return NextResponse.json(
      { error: 'Failed to get widget data' },
      { status: 500 }
    );
  }
}

// POST /api/widgets/:id/data - Push data to a widget (for bot updates)
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { id } = await params;

  try {
    const widget = getWidget(id);
    if (!widget) {
      return NextResponse.json(
        { error: 'Widget not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    
    // Update the widget's data cache
    updateWidgetData(id, body);

    // Return the updated data in bot-parseable format with cache metadata
    const updatedWidget = getWidget(id);
    if (!updatedWidget) {
      throw new Error('Failed to fetch updated widget');
    }

    const refreshInterval = getRefreshInterval(updatedWidget as { custom_widget_id?: string });
    const widgetData = await getWidgetData(updatedWidget);
    
    // Return combined response matching GET structure (Issue #3: POST missing cache metadata)
    return NextResponse.json({
      // Bot-parseable widget data
      ...widgetData,
      
      // Cache metadata
      cache: buildCacheMetadata(updatedWidget, refreshInterval)
    });
  } catch (error) {
    console.error('Failed to push widget data:', error);
    return NextResponse.json(
      { error: 'Failed to push widget data' },
      { status: 500 }
    );
  }
}
