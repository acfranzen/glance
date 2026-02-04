# Planning Task: Widget Refresh Button System

## Context

Glance is a personal dashboard with custom widgets. Widgets have different `fetch.type` values that determine how their data is collected:

```typescript
type FetchType = "server_code" | "webhook" | "agent_refresh";
```

Currently, `agent_refresh` widgets auto-poll via SWR every 30s, but there's no manual refresh button. We want to add a universal refresh mechanism that works for all fetch types.

## Current Architecture

- **DynamicWidget** (`src/components/dashboard/DynamicWidget.tsx`) - renders widgets, handles SWR polling for agent_refresh
- **Cache endpoint** (`/api/widgets/[slug]/cache`) - stores/retrieves cached data for agent_refresh widgets
- **Execute endpoint** (`/api/widgets/[slug]/execute`) - runs server_code for server_code widgets
- **Widget schema** has `fetch` field: `{ type, instructions?, refresh_endpoint?, ... }`

## Requirements

### 1. DynamicWidget Chrome (wrapper UI)

For ALL widgets, DynamicWidget should provide consistent chrome:
- **Refresh button** - triggers appropriate refresh pathway based on fetch.type
- **"Updated X ago" timestamp** - shown in footer, sourced from data.fetchedAt or cache metadata
- **Loading state** - spinner on refresh button while refresh is in progress

Widget source code should NOT include its own refresh button or timestamp footer - the wrapper handles this.

### 2. Refresh Behavior by Type

#### `server_code`
- Refresh button → POST to `/api/widgets/[slug]/execute`
- Server runs the widget's server_code with stored credentials
- Response updates widget data immediately
- Straightforward: dashboard can trigger directly

#### `webhook`  
- External service pushes data; dashboard can't trigger fetch
- Refresh button → just re-fetch from cache (SWR revalidate)
- Optionally: if `fetch.refresh_endpoint` is set, POST to that URL to request update
- Show "Data pushed by external service" or similar hint

#### `agent_refresh`
- Agent (AI assistant) fetches data and POSTs to cache endpoint
- Refresh button → POST to `/api/widgets/[slug]/refresh-request`
- Creates a pending refresh request that agent can poll/receive
- Agent picks up request, runs fetch.instructions, POSTs new data to cache
- SWR polling picks up the update

### 3. New Endpoint: `/api/widgets/[slug]/refresh-request`

```typescript
// POST - create refresh request
// Returns: { status: "requested", requestId: string, requestedAt: string }

// GET - check for pending requests (agent polls this)
// Returns: { pending: boolean, requestId?: string, requestedAt?: string }

// DELETE - clear request after agent processes it
// Returns: { status: "cleared" }
```

Store in SQLite: `widget_refresh_requests` table with slug, request_id, requested_at, status (pending/processing/completed).

### 4. UI Changes

**DynamicWidget wrapper:**
```tsx
<div className="widget-wrapper">
  {/* Widget content */}
  <WidgetComponent serverData={data} />
  
  {/* Chrome footer - always present for fetchable widgets */}
  <div className="widget-footer">
    <span className="updated-at">Updated {timeAgo(data.fetchedAt)}</span>
    <Button size="icon" variant="ghost" onClick={handleRefresh} disabled={isRefreshing}>
      <RefreshCw className={isRefreshing ? "animate-spin" : ""} />
    </Button>
  </div>
</div>
```

**handleRefresh logic:**
```typescript
async function handleRefresh() {
  setIsRefreshing(true);
  
  switch (widget.fetch.type) {
    case "server_code":
      await fetch(`/api/widgets/${slug}/execute`, { method: "POST" });
      break;
    case "agent_refresh":
      await fetch(`/api/widgets/${slug}/refresh-request`, { method: "POST" });
      // SWR will pick up new data when agent updates cache
      break;
    case "webhook":
      if (widget.fetch.refresh_endpoint) {
        await fetch(widget.fetch.refresh_endpoint, { method: "POST" });
      }
      // Just revalidate cache
      await mutate();
      break;
  }
  
  setIsRefreshing(false);
}
```

### 5. Agent Integration

The agent (OpenClaw) needs to either:
- **Poll** `/api/widgets/*/refresh-request` periodically (e.g., on heartbeat)
- **Receive webhook** when refresh is requested (if agent has webhook endpoint)

For now, polling is simpler. Agent heartbeat checks for pending refresh requests, processes them, clears them.

## Files to Modify

1. `src/components/dashboard/DynamicWidget.tsx` - add chrome wrapper with footer
2. `src/app/api/widgets/[slug]/refresh-request/route.ts` - new endpoint (create)
3. `src/lib/db.ts` - add refresh_requests table and functions
4. `docs/widget-sdk.md` - document refresh behavior
5. Existing widget source_code - remove manual refresh buttons/footers if any

## Out of Scope

- WebSocket for real-time refresh notifications (polling is fine for MVP)
- Rate limiting on refresh requests
- Refresh history/logging

## Success Criteria

1. All widgets have consistent refresh button + timestamp footer
2. server_code widgets refresh immediately on button click
3. agent_refresh widgets create request that agent can pick up
4. webhook widgets show appropriate UX (re-fetch cache or ping endpoint)
5. Widget authors don't need to implement refresh UI themselves
