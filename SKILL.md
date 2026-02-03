---
name: glance
description: AI-extensible personal dashboard. Create custom widgets via API to display GitHub PRs, API usage, weather, or any data source. Use when the user wants dashboard widgets, data visualizations, or to track metrics.
metadata:
  {
    "openclaw":
      {
        "emoji": "⚡",
        "homepage": "https://github.com/acfranzen/glance",
        "requires": { "env": ["GLANCE_URL"] },
        "primaryEnv": "GLANCE_URL",
      },
  }
---

# Glance Dashboard

Personal dashboard at `$GLANCE_URL` (default: `http://localhost:3333`).

## API Overview

| Endpoint                            | Method | Purpose                          |
| ----------------------------------- | ------ | -------------------------------- |
| `/api/credentials`                  | POST   | Store API keys (encrypted)       |
| `/api/credentials`                  | GET    | List stored credentials + status |
| `/api/custom-widgets`               | POST   | Create widget definition (code)  |
| `/api/custom-widgets`               | GET    | List widget definitions          |
| `/api/custom-widgets/:slug`         | PATCH  | Update widget definition         |
| `/api/custom-widgets/:slug/execute` | POST   | Execute server code              |
| `/api/widgets`                      | POST   | Add widget to dashboard          |
| `/api/widgets`                      | GET    | List dashboard widgets           |

## Creating a Widget (Full Workflow)

### 1. Store credentials (if needed)

```bash
curl -X POST $GLANCE_URL/api/credentials \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "github",
    "name": "My GitHub Token",
    "value": "ghp_xxxxxxxxxxxx"
  }'
```

Providers: `github`, `anthropic`, `openai`, `vercel`, `openweather`

### 2. Create widget definition

```bash
curl -X POST $GLANCE_URL/api/custom-widgets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Widget",
    "description": "Widget description",
    "source_code": "function Widget() { ... }",
    "server_code": "const token = await getCredential(\"github\"); ...",
    "server_code_enabled": true,
    "data_providers": ["github"],
    "default_size": { "w": 4, "h": 3 },
    "min_size": { "w": 2, "h": 2 },
    "refresh_interval": 300
  }'
# Returns: { "id": "cw_abc123", "slug": "my-widget", ... }
```

### 3. Add to dashboard

```bash
curl -X POST $GLANCE_URL/api/widgets \
  -H "Content-Type: application/json" \
  -d '{
    "type": "custom",
    "title": "My Widget",
    "custom_widget_id": "cw_abc123",
    "config": { "owner": "acfranzen", "repo": "glance" }
  }'
```

### 4. Execute server code (get fresh data)

```bash
curl -X POST $GLANCE_URL/api/custom-widgets/my-widget/execute \
  -H "Content-Type: application/json" \
  -d '{ "params": {} }'
# Returns: { "data": { ... } }
```

## Widget Code Structure

### Client code (`source_code`)

```tsx
function Widget() {
  const { data, loading, error, refresh } = useData("github", {
    endpoint: "/pulls",
  });

  if (loading) return <Loading />;
  if (error) return <ErrorDisplay message={error.message} retry={refresh} />;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Title</CardTitle>
      </CardHeader>
      <CardContent>
        <List
          items={data.map((item) => ({
            title: item.title,
            subtitle: item.description,
            badge: item.state,
          }))}
        />
      </CardContent>
    </Card>
  );
}
```

### Server code (`server_code`)

```javascript
const token = await getCredential("github");

const response = await fetch("https://api.github.com/repos/owner/repo/pulls", {
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
  },
});

const pulls = await response.json();
return { items: pulls, fetchedAt: new Date().toISOString() };
```

## Multi-Repo Pattern

Fetch from multiple sources and combine:

```javascript
const token = await getCredential("github");
const repos = ["owner/repo1", "owner/repo2"];

const results = await Promise.all(
  repos.map(async (repo) => {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/pulls?state=open`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      },
    );
    const pulls = await res.json();
    return pulls.map((pr) => ({ ...pr, repo }));
  }),
);

return { items: results.flat(), fetchedAt: new Date().toISOString() };
```

## Available Components

Components are from [shadcn/ui](https://ui.shadcn.com/docs/components) — see their docs for full prop references.

Layout: `Card`, `CardHeader`, `CardContent`, `CardFooter`, `CardTitle`, `CardDescription`, `Stack`, `Grid`

Data: `Stat`, `Progress`, `Badge`, `List`, `Avatar`

State: `Loading`, `ErrorDisplay`, `Empty`

Form: `Button`, `Input`, `Label`, `Switch`

Other: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`, `Tooltip`, `Separator`

### Icons

Subset of [Lucide React](https://lucide.dev/icons/) icons. **Only these are available:**

`Activity`, `AlertCircle`, `AlertTriangle`, `ArrowDown`, `ArrowUp`, `BarChart2`, `Check`, `ChevronRight`, `Clock`, `Code`, `Coffee`, `Copy`, `Download`, `Edit`, `ExternalLink`, `Eye`, `EyeOff`, `FileText`, `GitPullRequest`, `Globe`, `Heart`, `Home`, `Info`, `Loader2`, `Lock`, `Mail`, `MessageSquare`, `Minus`, `MoreHorizontal`, `MoreVertical`, `Package`, `Plus`, `RefreshCw`, `Search`, `Settings`, `Star`, `Trash`, `TrendingDown`, `TrendingUp`, `Unlock`, `Upload`, `User`, `X`, `Zap`

Usage: `<Icons.Globe className="h-4 w-4" />`

## Available Hooks

- `useData(provider, query)` — fetch data **(both args required, even with server code)**
- `useConfig()` — access widget config (set on widget instance)
- `useWidgetState(key, default)` — persistent widget state

**⚠️ useData requires both arguments:**
```tsx
// ✅ Correct
const { data, loading, error } = useData('github', {});
const { data, loading, error } = useData('vercel', { endpoint: '/deployments' });

// ❌ Wrong - throws error
const { data, loading, error } = useData();
```

## Server Code Rules

**Allowed:** `fetch`, `getCredential(provider)`, `params`, `console.log`, `JSON`, `Date`, `Math`, `Promise`

**Blocked:** `require`, `import`, `eval`, `process`, `fs`, `child_process`

## Built-in Widgets

### Claude Max Usage Widget

The Claude Max widget displays your Claude Max subscription usage (session, weekly, extra usage).

**⚠️ Requires OpenClaw PTY:** The Claude CLI needs an interactive terminal to display usage data. Glance cannot capture this directly — OpenClaw must do the PTY capture.

**How the refresh flow works:**

1. User clicks refresh button on Claude Max widget
2. Glance POSTs to `/api/widgets/claude-max/refresh` (creates request file)
3. OpenClaw cron job detects the request file
4. OpenClaw spawns subagent to do PTY capture
5. Subagent writes to `/tmp/claude-usage-cache.json`
6. Glance polls (every 30s) and sees fresh data

**API Endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/widgets/claude-max/data` | GET | Read cached usage data |
| `/api/widgets/claude-max/refresh` | POST | Request OpenClaw to capture fresh data |
| `/api/widgets/claude-max/refresh` | GET | Check if refresh is pending |
| `/api/widgets/claude-max/refresh` | DELETE | Clear refresh request (called by OpenClaw) |

**OpenClaw cron job setup:**

Add to your OpenClaw config or HEARTBEAT.md:
```
Check /tmp/claude-usage-refresh-requested — if exists, spawn subagent to capture Claude usage
```

**OpenClaw PTY capture task (for subagent):**

```
Capture Claude Max usage:
1. Spawn claude CLI with pty: true
2. Send /status, navigate to Usage tab (Right, Right)
3. Parse output for percentages and reset times
4. Write to /tmp/claude-usage-cache.json
5. DELETE /api/widgets/claude-max/refresh to clear request
```

**Cache file format** (`/tmp/claude-usage-cache.json`):
```json
{
  "session": { "percentUsed": 42, "resetsAt": "6pm EST" },
  "weekAll": { "percentUsed": 100, "resetsAt": "1pm EST" },
  "weekOpus": { "percentUsed": 2, "resetsAt": "Feb 6, 11am" },
  "extra": { "spent": 86.11, "limit": 100, "percentUsed": 86, "resetsAt": "Mar 1" },
  "capturedAt": "2026-02-02T23:59:00.000Z"
}
```

## Full Documentation

Component props, styling, and advanced patterns: [docs/widget-sdk.md](docs/widget-sdk.md)
