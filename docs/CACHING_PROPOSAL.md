# Widget Data Caching Proposal

## Executive Summary

This document analyzes Glance's custom widget data fetching architecture and proposes a SQLite-based caching layer to eliminate redundant API calls.

---

## Part 1: Analysis — Why the Current System Doesn't Cache

### Current Data Flow

```
┌─────────────────┐     ┌───────────────────────────┐     ┌──────────────────┐
│  DynamicWidget  │────▶│  POST /api/.../execute    │────▶│  server-executor │
│  (React)        │     │  (route.ts)               │     │  (VM sandbox)    │
│                 │◀────│                           │◀────│                  │
└─────────────────┘     └───────────────────────────┘     └──────────────────┘
        │                                                          │
        │  Every render/refresh                                    │
        │  fetches fresh data                                      ▼
        │                                                   External APIs
        └────────────────── No cache check ────────────────────────┘
```

### Why Caching Doesn't Exist

**1. The execute endpoint (`route.ts`) has no cache awareness**

```typescript
// Current: src/app/api/custom-widgets/[slug]/execute/route.ts
export async function POST(request: NextRequest, context: RouteContext) {
  // ...validation...
  
  // ❌ No cache check - immediately executes server code
  const result = await executeServerCode(widget.server_code, {
    params,
    timeout: 5000,
    fetchConfig: widget.fetch,
  });
  
  return NextResponse.json({ data: result.data });
}
```

**2. DynamicWidget always fetches on mount and has no concept of "cached data"**

```typescript
// Current: src/components/widgets/DynamicWidget.tsx
useEffect(() => {
  // ❌ Fetches every time - no cache check
  async function fetchServerData() {
    const response = await fetch(`/api/custom-widgets/${slug}/execute`, ...);
    setServerData(result.data);
  }
  fetchServerData();
}, [state.definition?.server_code_enabled, ...]);
```

**3. The database schema has caching columns, but they're orphaned**

```sql
-- widgets table has these columns, but they're NOT used for custom widgets:
data_cache TEXT,
data_updated_at TEXT
```

The `updateWidgetData()` function exists in `db.ts` but is never called in the custom widget flow.

**4. The `useData` hook (`hooks.ts`) always fetches fresh**

```typescript
// No cache parameter, no staleness check
const fetchData = useCallback(async () => {
  response = await fetch(`/api/custom-widgets/${slug}/execute`, {...});
  // ❌ Always fetches, never checks cache
}, [...]);
```

**5. `refresh_interval` is misunderstood**

The `refresh_interval` field in `custom_widgets` is used only for **client-side polling** (auto-refresh every N seconds), NOT for cache TTL. It triggers fresh fetches, not cache invalidation.

### Summary: The Cache Gap

| Component | Cache Support |
|-----------|--------------|
| Database schema | ✅ Has columns (unused) |
| Execute API endpoint | ❌ No cache check |
| DynamicWidget | ❌ Always fetches fresh |
| useData hook | ❌ No cache awareness |
| server-executor | ❌ No cache write |

---

## Part 2: Proposed Caching Layer Design

### Design Goals

1. **Serve cached data by default** — Only hit external APIs when necessary
2. **Per-widget TTL** — Use `refresh_interval` as cache duration
3. **Force refresh** — Allow explicit "get fresh data" requests
4. **Widget instance scoping** — Cache per widget *instance*, not definition
5. **Minimal changes** — Work with existing architecture

### Database Schema

Create a new table specifically for widget data caching:

```sql
CREATE TABLE IF NOT EXISTS widget_data_cache (
    -- Composite key: widget instance + definition for uniqueness
    widget_instance_id TEXT NOT NULL,  -- From widgets.id (the placed widget)
    custom_widget_id TEXT NOT NULL,    -- From custom_widgets.id (the definition)
    
    -- Cached data
    data TEXT NOT NULL,                -- JSON-serialized response
    
    -- Cache metadata
    fetched_at TEXT NOT NULL,          -- When data was fetched (ISO 8601)
    expires_at TEXT NOT NULL,          -- When cache becomes stale (ISO 8601)
    
    -- For debugging/auditing
    params_hash TEXT,                  -- Hash of request params (for param-sensitive caching)
    
    PRIMARY KEY (widget_instance_id),
    FOREIGN KEY (widget_instance_id) REFERENCES widgets(id) ON DELETE CASCADE,
    FOREIGN KEY (custom_widget_id) REFERENCES custom_widgets(id) ON DELETE CASCADE
);

CREATE INDEX idx_widget_data_cache_expires ON widget_data_cache(expires_at);
CREATE INDEX idx_widget_data_cache_custom_widget ON widget_data_cache(custom_widget_id);
```

### Cache Logic Flow

```
┌───────────────────────────────────────────────────────────────────────────┐
│                         CACHE DECISION FLOW                               │
└───────────────────────────────────────────────────────────────────────────┘

    Client Request (with widget_instance_id, optional force_refresh)
                              │
                              ▼
                   ┌──────────────────┐
                   │ force_refresh?   │
                   └────────┬─────────┘
                      yes   │   no
              ┌─────────────┴────────────┐
              │                          ▼
              │               ┌──────────────────┐
              │               │ Cache exists?    │
              │               └────────┬─────────┘
              │                  no    │   yes
              │        ┌───────────────┴──────────────┐
              │        │                              ▼
              │        │                   ┌──────────────────┐
              │        │                   │ Cache expired?   │
              │        │                   └────────┬─────────┘
              │        │                      yes   │   no
              │        │        ┌──────────────────┬┘
              ▼        ▼        ▼                  ▼
        ┌─────────────────────────┐         ┌─────────────────┐
        │   Execute Server Code   │         │  Return Cached  │
        │   & Update Cache        │         │  Data (fast!)   │
        └─────────────────────────┘         └─────────────────┘
```

### API Changes

**Execute Endpoint: Before**
```
POST /api/custom-widgets/[slug]/execute
Body: { params: {...} }
Response: { data: {...} }
```

**Execute Endpoint: After**
```
POST /api/custom-widgets/[slug]/execute
Body: { 
  params: {...},
  widget_instance_id: "w_abc123",  // NEW: identifies the placed widget
  force_refresh: false              // NEW: bypass cache
}
Response: { 
  data: {...},
  cached: true,                    // NEW: was this from cache?
  cached_at: "2026-02-03T12:00:00Z", // NEW: when was it cached
  expires_at: "2026-02-03T12:05:00Z" // NEW: when does it expire
}
```

---

## Part 3: Implementation Plan

### Files to Modify

#### 1. `src/lib/db.ts` — Add cache table and functions

**Changes:**
- Add `widget_data_cache` table creation in schema initialization
- Add prepared statements for cache operations
- Add new functions:

```typescript
// New types
export interface WidgetDataCache {
  widget_instance_id: string;
  custom_widget_id: string;
  data: unknown;
  fetched_at: string;
  expires_at: string;
  params_hash: string | null;
}

// New functions to add
export function getWidgetDataCache(instanceId: string): WidgetDataCache | undefined;
export function setWidgetDataCache(
  instanceId: string, 
  customWidgetId: string,
  data: unknown,
  ttlSeconds: number,
  paramsHash?: string
): void;
export function deleteWidgetDataCache(instanceId: string): void;
export function deleteExpiredCache(): number; // Returns count deleted
```

#### 2. `src/app/api/custom-widgets/[slug]/execute/route.ts` — Add cache layer

**Changes:**
- Accept `widget_instance_id` and `force_refresh` in request body
- Check cache before executing server code
- Store result in cache after execution
- Return cache metadata in response

```typescript
// Pseudocode for new logic
export async function POST(request: NextRequest, context: RouteContext) {
  const { params, widget_instance_id, force_refresh = false } = await request.json();
  
  // 1. Get widget definition (existing)
  const widget = findCustomWidget(slug);
  
  // 2. NEW: Check cache (unless force_refresh)
  if (!force_refresh && widget_instance_id) {
    const cached = getWidgetDataCache(widget_instance_id);
    if (cached && new Date(cached.expires_at) > new Date()) {
      return NextResponse.json({
        data: JSON.parse(cached.data),
        cached: true,
        cached_at: cached.fetched_at,
        expires_at: cached.expires_at,
      });
    }
  }
  
  // 3. Execute server code (existing)
  const result = await executeServerCode(widget.server_code, {...});
  
  // 4. NEW: Cache the result
  if (widget_instance_id && result.data) {
    setWidgetDataCache(
      widget_instance_id,
      widget.id,
      result.data,
      widget.refresh_interval // Use as TTL in seconds
    );
  }
  
  // 5. Return with cache metadata
  return NextResponse.json({
    data: result.data,
    cached: false,
    expires_at: new Date(Date.now() + widget.refresh_interval * 1000).toISOString(),
  });
}
```

#### 3. `src/components/widgets/DynamicWidget.tsx` — Pass instance ID, handle refresh

**Changes:**
- Pass `widgetId` (the instance ID) to the execute endpoint
- Add refresh button/callback that triggers `force_refresh: true`
- Show cache status indicator (optional)

```typescript
// In fetchServerData():
const response = await fetch(`/api/custom-widgets/${slug}/execute`, {
  method: 'POST',
  body: JSON.stringify({ 
    params: config,
    widget_instance_id: widgetId,  // NEW
    force_refresh: false,          // NEW (or true when refresh clicked)
  }),
});

// Handle response cache metadata
const result = await response.json();
setServerData(result.data);
setCachedAt(result.cached_at);  // NEW state for UI
```

#### 4. `src/lib/widget-sdk/hooks.ts` — Add force refresh support

**Changes:**
- Add `forceRefresh` parameter to `refresh()` function
- Pass through to API calls

```typescript
// In createUseData:
const refresh = useCallback((forceRefresh: boolean = false) => {
  fetchData(forceRefresh);
}, [fetchData]);

// In fetchData:
body: JSON.stringify({
  params: {...},
  widget_instance_id: widgetId,
  force_refresh: forceRefresh,  // NEW
}),
```

#### 5. (Optional) Cache cleanup cron/background job

**New file:** `src/lib/cache-cleanup.ts`

```typescript
// Run periodically to clean expired cache entries
export function cleanupExpiredCache() {
  const deleted = deleteExpiredCache();
  console.log(`[cache-cleanup] Deleted ${deleted} expired cache entries`);
}
```

Can be called from a heartbeat, cron job, or lazily on API requests.

---

## Part 4: Migration Strategy

### Phase 1: Database Schema (Non-breaking)
1. Add `widget_data_cache` table
2. Deploy — no behavior change yet

### Phase 2: Backend Cache Layer (Backward Compatible)
1. Modify execute endpoint to read/write cache
2. If `widget_instance_id` not provided, behave as before (no cache)
3. Deploy — existing clients work unchanged

### Phase 3: Frontend Integration
1. Update DynamicWidget to pass instance ID
2. Add refresh UI (optional)
3. Deploy — now fully cached

---

## Part 5: Benefits & Trade-offs

### Benefits

| Metric | Before | After |
|--------|--------|-------|
| API calls per page load | N (once per widget) | 0-N (only on cache miss) |
| External API usage | Every render | Every `refresh_interval` |
| Page load latency | High (waits for APIs) | Low (cached data instant) |
| Resilience | Fails if API down | Shows stale data |

### Trade-offs

1. **Stale data** — Users see cached data until TTL expires or manual refresh
   - Mitigation: Show "last updated" timestamp, provide refresh button

2. **Storage growth** — Cache table grows with widgets
   - Mitigation: Cleanup job, cascade delete on widget removal

3. **Param sensitivity** — Different params might need different caches
   - Mitigation: `params_hash` column for param-aware caching (optional enhancement)

---

## Appendix: Quick Reference

### New Database Functions
```typescript
getWidgetDataCache(instanceId: string): WidgetDataCache | undefined
setWidgetDataCache(instanceId, customWidgetId, data, ttlSeconds, paramsHash?): void
deleteWidgetDataCache(instanceId: string): void
deleteExpiredCache(): number
```

### New API Parameters
```typescript
// Request body additions
{
  widget_instance_id: string;  // Required for caching
  force_refresh?: boolean;     // Bypass cache
}

// Response additions
{
  cached: boolean;
  cached_at?: string;
  expires_at?: string;
}
```

### Cache Table Schema
```sql
widget_data_cache (
  widget_instance_id TEXT PRIMARY KEY,
  custom_widget_id TEXT NOT NULL,
  data TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  params_hash TEXT
)
```
