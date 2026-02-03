import { NextRequest, NextResponse } from 'next/server';

// Prevent static generation - this route requires runtime database access
export const dynamic = 'force-dynamic';
import { validateAuthOrInternal } from '@/lib/auth';
import { 
  getCustomWidget, 
  getCustomWidgetBySlug, 
  getCachedWidgetData, 
  setCachedWidgetData 
} from '@/lib/db';
import { executeServerCode, validateServerCode } from '@/lib/widget-sdk/server-executor';

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

  try {
    const { slug } = await context.params;
    const widget = findCustomWidget(slug);

    if (!widget) {
      return NextResponse.json(
        { error: 'Custom widget not found' },
        { status: 404 }
      );
    }

    // Parse request body for params
    let params: Record<string, unknown> = {};
    let widgetInstanceId: string | undefined;
    let forceRefresh = false;
    
    try {
      const body = await request.json();
      params = body.params || {};
      widgetInstanceId = body.widget_instance_id;
      forceRefresh = body.force_refresh === true;
    } catch {
      // No body or invalid JSON - use empty params
    }

    // For agent_refresh widgets, return cached data (no server_code needed)
    if (widget.fetch?.type === 'agent_refresh') {
      if (!widgetInstanceId) {
        return NextResponse.json(
          { error: 'widget_instance_id required for agent_refresh widgets' },
          { status: 400 }
        );
      }
      
      const cached = getCachedWidgetData(widgetInstanceId);
      const now = new Date();
      const cacheConfig = widget.cache;
      
      if (cached) {
        const fetchedAt = new Date(cached.fetched_at);
        const ageSeconds = Math.floor((now.getTime() - fetchedAt.getTime()) / 1000);
        const ttlSeconds = cacheConfig?.ttl_seconds ?? widget.refresh_interval ?? 300;
        const maxStalenessSeconds = cacheConfig?.max_staleness_seconds ?? ttlSeconds * 3;
        
        // Data is fresh (within TTL)
        if (ageSeconds <= ttlSeconds) {
          return NextResponse.json({
            data: cached.data,
            fromCache: true,
            cachedAt: cached.fetched_at,
            expiresAt: cached.expires_at,
            freshness: 'fresh',
          });
        }
        
        // Data is stale but within max staleness - return with warning
        if (ageSeconds <= maxStalenessSeconds) {
          return NextResponse.json({
            data: cached.data,
            fromCache: true,
            cachedAt: cached.fetched_at,
            expiresAt: cached.expires_at,
            freshness: 'stale',
            staleWarning: `Data is ${Math.floor(ageSeconds / 60)} minutes old. Agent should refresh.`,
          });
        }
      }
      
      // No cache or data is too stale
      const onError = cacheConfig?.on_error ?? 'show_error';
      if (cached && onError === 'use_stale') {
        return NextResponse.json({
          data: cached.data,
          fromCache: true,
          cachedAt: cached.fetched_at,
          expiresAt: cached.expires_at,
          freshness: 'expired',
          staleWarning: 'Data is expired. Agent needs to refresh.',
        });
      }
      
      // No cache or expired - return error with instructions
      return NextResponse.json({
        data: null,
        error: 'No cached data available. Agent needs to refresh.',
        instructions: widget.fetch.instructions,
        stale: cached ? true : false,
        staleData: cached?.data,
      });
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

    // Check cache if we have a widget instance ID and not forcing refresh
    if (widgetInstanceId && !forceRefresh) {
      const cached = getCachedWidgetData(widgetInstanceId);
      if (cached) {
        const now = new Date();
        const fetchedAt = new Date(cached.fetched_at);
        const ageSeconds = Math.floor((now.getTime() - fetchedAt.getTime()) / 1000);
        const cacheConfig = widget.cache;
        const ttlSeconds = cacheConfig?.ttl_seconds ?? widget.refresh_interval ?? 300;
        
        // Cache hit - data is still fresh
        if (ageSeconds <= ttlSeconds) {
          return NextResponse.json({
            data: cached.data,
            fromCache: true,
            cachedAt: cached.fetched_at,
            expiresAt: cached.expires_at,
            freshness: 'fresh',
          });
        }
        
        // Check stale-while-revalidate
        const maxStalenessSeconds = cacheConfig?.max_staleness_seconds;
        if (maxStalenessSeconds && ageSeconds <= maxStalenessSeconds) {
          // Return stale data but continue to revalidate below
          return NextResponse.json({
            data: cached.data,
            fromCache: true,
            cachedAt: cached.fetched_at,
            expiresAt: cached.expires_at,
            freshness: 'stale',
            staleWarning: `Data is ${Math.floor(ageSeconds / 60)} minutes old.`,
          });
        }
      }
    }

    // Validate the server code patterns
    const validation = validateServerCode(widget.server_code);
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Invalid server code: ${validation.error}` },
        { status: 400 }
      );
    }

    // Execute the server code
    const result = await executeServerCode(widget.server_code, {
      params,
      timeout: 5000,
    });

    if (result.error) {
      // Check on_error setting - if use_stale, try to return cached data
      const cacheConfig = widget.cache;
      const onError = cacheConfig?.on_error ?? 'show_error';
      
      if (onError === 'use_stale' && widgetInstanceId) {
        const cached = getCachedWidgetData(widgetInstanceId);
        if (cached) {
          return NextResponse.json({
            data: cached.data,
            fromCache: true,
            cachedAt: cached.fetched_at,
            expiresAt: cached.expires_at,
            freshness: 'stale',
            staleWarning: `Using stale data due to error: ${result.error}`,
            originalError: result.error,
          });
        }
      }
      
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    // Cache the result if we have a widget instance ID
    const cacheConfig = widget.cache;
    const ttlSeconds = cacheConfig?.ttl_seconds ?? widget.refresh_interval ?? 300;
    let expiresAt: string | undefined;
    
    if (widgetInstanceId && result.data !== undefined) {
      setCachedWidgetData(
        widgetInstanceId,
        widget.id,
        result.data,
        ttlSeconds
      );
      expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    }

    return NextResponse.json({ 
      data: result.data,
      fromCache: false,
      freshness: 'fresh',
      ...(expiresAt && { expiresAt }),
    });
  } catch (error) {
    console.error('Failed to execute server code:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to execute server code' },
      { status: 500 }
    );
  }
}
