import { NextRequest, NextResponse } from 'next/server';

// Prevent static generation - this route requires runtime database access
export const dynamic = 'force-dynamic';
import { validateAuthOrInternal } from '@/lib/auth';
import { getWidget, getCustomWidget, updateWidgetData } from '@/lib/db';
import { getWidgetData } from '@/lib/widget-data';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface CachedDataMeta {
  data: unknown;
  provider: string;
  fetchedAt: string;
  endpoint: string;
}

// Check if cached data is stale based on refresh_interval
function isStale(dataUpdatedAt: string | null, refreshIntervalSeconds: number): boolean {
  if (!dataUpdatedAt) return true;
  
  const cacheTime = new Date(dataUpdatedAt).getTime();
  const now = Date.now();
  const maxAgeMs = refreshIntervalSeconds * 1000;
  
  return (now - cacheTime) >= maxAgeMs;
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

    // Get refresh interval from custom widget definition (if it's a custom widget)
    let refreshInterval = 300; // Default 5 minutes
    const customWidgetId = (widget as { custom_widget_id?: string }).custom_widget_id;
    if (customWidgetId) {
      const customWidget = getCustomWidget(customWidgetId);
      if (customWidget) {
        refreshInterval = customWidget.refresh_interval;
      }
    }

    // Get the bot-parseable widget data (includes summary, narratives, etc.)
    const widgetData = await getWidgetData(widget);

    // Parse cache metadata if available
    let cacheMeta: CachedDataMeta | null = null;
    if (widget.data_cache) {
      try {
        cacheMeta = JSON.parse(widget.data_cache) as CachedDataMeta;
      } catch {
        // Cache data might be in old format or corrupted
        cacheMeta = null;
      }
    }

    const stale = isStale(widget.data_updated_at, refreshInterval);

    // Return combined response with both formats
    return NextResponse.json({
      // Bot-parseable widget data
      ...widgetData,
      
      // Cache metadata
      cache: {
        cached: !!widget.data_cache,
        cachedAt: cacheMeta?.fetchedAt ?? widget.data_updated_at,
        source: cacheMeta?.provider ?? null,
        endpoint: cacheMeta?.endpoint ?? null,
        stale,
        refreshInterval,
        dataUpdatedAt: widget.data_updated_at
      }
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

    // Return the updated data in bot-parseable format
    const updatedWidget = getWidget(id);
    if (!updatedWidget) {
      throw new Error('Failed to fetch updated widget');
    }

    const data = await getWidgetData(updatedWidget);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to push widget data:', error);
    return NextResponse.json(
      { error: 'Failed to push widget data' },
      { status: 500 }
    );
  }
}
