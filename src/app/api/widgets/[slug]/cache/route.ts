import { NextRequest, NextResponse } from "next/server";
import { validateAuthOrInternal } from "@/lib/auth";
import { getCustomWidgetBySlug, setCachedWidgetData, getCachedWidgetData, getWidgetsByCustomWidgetId } from "@/lib/db";
import { validateDataSchema, formatValidationErrors } from "@/lib/schema-validator";

// Prevent static generation - this route requires runtime database access
export const dynamic = "force-dynamic";

interface CacheData {
  _meta?: {
    updated_at: string;
    updated_by?: string;
  };
  data: unknown;
}

/**
 * GET /api/widgets/[slug]/cache - Get cached data for a widget
 * 
 * Returns the cached data if available, with freshness metadata.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { slug } = await params;
  const widget = getCustomWidgetBySlug(slug);
  
  if (!widget) {
    return NextResponse.json({ error: "Widget not found" }, { status: 404 });
  }

  // Get widget instances to find cached data
  const instances = getWidgetsByCustomWidgetId(widget.id);
  if (instances.length === 0) {
    return NextResponse.json({ 
      error: "No widget instance found. Add the widget to the dashboard first.",
      has_cache: false 
    }, { status: 404 });
  }

  // Get cached data from the first instance
  const cached = getCachedWidgetData(instances[0].id);
  
  if (!cached) {
    return NextResponse.json({ 
      has_cache: false,
      message: "No cached data available" 
    });
  }

  const now = new Date();
  const fetchedAt = new Date(cached.fetched_at);
  const expiresAt = new Date(cached.expires_at);
  const ageSeconds = Math.floor((now.getTime() - fetchedAt.getTime()) / 1000);
  const isExpired = now > expiresAt;
  
  // Check freshness against widget's cache config, falling back to fetch config
  const cacheConfig = widget.cache;
  const fetch = widget.fetch;
  let freshness: "fresh" | "stale" | "expired" = "fresh";
  
  // Use cache config if available, otherwise fall back to fetch config
  const ttlSeconds = cacheConfig?.ttl_seconds ?? 
    (fetch?.type === "agent_refresh" ? (fetch.expected_freshness_seconds ?? 300) : widget.refresh_interval ?? 300);
  const maxStalenessSeconds = cacheConfig?.max_staleness_seconds ?? 
    (fetch?.type === "agent_refresh" ? (fetch.max_staleness_seconds ?? ttlSeconds * 3) : undefined);
  
  if (ageSeconds > (maxStalenessSeconds ?? ttlSeconds * 3)) {
    freshness = "expired";
  } else if (ageSeconds > ttlSeconds) {
    freshness = "stale";
  }

  return NextResponse.json({
    has_cache: true,
    data: cached.data,
    fetched_at: cached.fetched_at,
    expires_at: cached.expires_at,
    age_seconds: ageSeconds,
    freshness,
  });
}

/**
 * POST /api/widgets/[slug]/cache - Push data to widget cache
 * 
 * Used by agents to populate cache for agent_refresh widgets.
 * Stores data in SQLite with automatic TTL based on widget config.
 * 
 * Body:
 * - data: The data to cache (required)
 * - updated_by: Optional identifier for who updated the cache
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { slug } = await params;
  const widget = getCustomWidgetBySlug(slug);
  
  if (!widget) {
    return NextResponse.json({ error: "Widget not found" }, { status: 404 });
  }

  // Validate this is an agent_refresh widget
  if (widget.fetch?.type !== "agent_refresh") {
    return NextResponse.json({ 
      error: "This widget does not use agent_refresh. Only agent_refresh widgets can have data pushed to them.",
      fetch_type: widget.fetch?.type 
    }, { status: 400 });
  }

  let body: CacheData;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.data === undefined) {
    return NextResponse.json({ error: "data field is required" }, { status: 400 });
  }

  // Validate data against widget's schema if defined
  if (widget.dataSchema) {
    const validation = validateDataSchema(body.data, widget.dataSchema);
    if (!validation.valid) {
      return NextResponse.json({ 
        error: "Data validation failed against widget schema",
        validation_errors: validation.errors,
        message: formatValidationErrors(validation.errors),
        expected_schema: widget.dataSchema,
      }, { status: 400 });
    }
  }

  // Get or create widget instance
  const instances = getWidgetsByCustomWidgetId(widget.id);
  
  if (instances.length === 0) {
    return NextResponse.json({ 
      error: "No widget instance found. Add the widget to the dashboard first, then push data.",
    }, { status: 400 });
  }

  // Calculate TTL from widget's cache config, falling back to fetch config, then defaults
  const cacheConfig = widget.cache;
  let ttlSeconds: number;
  
  if (cacheConfig?.ttl_seconds !== undefined) {
    // Use explicit cache TTL if configured
    ttlSeconds = cacheConfig.ttl_seconds;
  } else {
    // Fall back to fetch config (for backward compatibility)
    const expectedFreshness = widget.fetch.expected_freshness_seconds || 300;
    ttlSeconds = widget.fetch.max_staleness_seconds || expectedFreshness * 3;
  }
  
  // If max_staleness is set in cache config, use it for the actual cache TTL
  // (data should remain in cache until max staleness is reached)
  if (cacheConfig?.max_staleness_seconds !== undefined) {
    ttlSeconds = cacheConfig.max_staleness_seconds;
  }

  // Add metadata wrapper
  const dataWithMeta = {
    _meta: {
      updated_at: new Date().toISOString(),
      updated_by: body._meta?.updated_by || "agent",
    },
    ...body.data,
  };

  // Store in cache for all instances of this widget
  for (const instance of instances) {
    setCachedWidgetData(
      instance.id,
      widget.id,
      dataWithMeta,
      ttlSeconds
    );
  }

  return NextResponse.json({
    success: true,
    message: `Cache updated for ${instances.length} widget instance(s)`,
    ttl_seconds: ttlSeconds,
    expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
  });
}

/**
 * DELETE /api/widgets/[slug]/cache - Clear cached data
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { slug } = await params;
  const widget = getCustomWidgetBySlug(slug);
  
  if (!widget) {
    return NextResponse.json({ error: "Widget not found" }, { status: 404 });
  }

  const instances = getWidgetsByCustomWidgetId(widget.id);
  
  // Clear cache for all instances (set empty data with 0 TTL)
  for (const instance of instances) {
    setCachedWidgetData(instance.id, widget.id, null, 0);
  }

  return NextResponse.json({
    success: true,
    message: `Cache cleared for ${instances.length} widget instance(s)`,
  });
}
