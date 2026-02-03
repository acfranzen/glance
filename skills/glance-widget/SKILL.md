---
name: glance-widget
description: "Create, update, export, and import Glance dashboard widgets. Use when user wants to: add something to their dashboard, create a widget, track data visually, show metrics/stats, display API data, monitor usage, or asks about dashboard customization. Supports server_code (API-driven), webhook, and agent_refresh (AI-populated) widget types."
metadata: { "openclaw": { "emoji": "📊" } }
---

# Glance Widget SDK

Create custom dashboard widgets that display data from any API.

## Quick Reference

- **Full SDK docs:** See `docs/widget-sdk.md` in the Glance repo
- **Component list:** See [references/components.md](references/components.md)

## Widget Package Structure

```
Widget Package
├── meta (name, slug, description, author, version)
├── widget (source_code, default_size, min_size)
├── fetch (server_code | webhook | agent_refresh)
├── cache (ttl, staleness, fallback)
├── credentials[] (API keys, local software requirements)
├── config_schema? (user options)
└── error? (retry, fallback, timeout)
```

## Fetch Type Decision Tree

```
Is data available via API?
├── YES → Can widget call directly (auth available)?
│   ├── YES → Use server_code
│   └── NO → Use agent_refresh
└── NO → Use agent_refresh (agent computes/fetches)
```

| Scenario | Fetch Type | Example |
|----------|-----------|---------|
| Authenticated API (GitHub, etc.) | `server_code` | GitHub PRs, Linear issues |
| Public API with CORS | `server_code` | Weather APIs |
| External webhook pushes data | `webhook` | Stripe events |
| Local software required | `agent_refresh` | Homebrew packages |
| Agent must compute/fetch | `agent_refresh` | System stats |

## API Endpoints

### Widget Definitions
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/custom-widgets` | Create widget definition |
| `GET` | `/api/custom-widgets` | List all definitions |
| `GET` | `/api/custom-widgets/:slug` | Get single definition |
| `PATCH` | `/api/custom-widgets/:slug` | Update definition |
| `DELETE` | `/api/custom-widgets/:slug` | Delete definition |

### Widget Instances (Dashboard)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/widgets` | Add widget to dashboard |
| `GET` | `/api/widgets` | List dashboard widgets |
| `PATCH` | `/api/widgets/:id` | Update instance (config, position) |
| `DELETE` | `/api/widgets/:id` | Remove from dashboard |

### Credentials
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/credentials` | List credentials + status |
| `POST` | `/api/credentials` | Store credential |
| `DELETE` | `/api/credentials/:id` | Delete credential |

## Creating a Widget

### Step 1: Check Credentials

```http
GET /api/credentials
```

Check `status.{provider}.configured` for required credentials.

### Step 2: Create Widget Definition

```http
POST /api/custom-widgets
Content-Type: application/json

{
  "name": "GitHub PRs",
  "description": "Shows open pull requests",
  "source_code": "function Widget() { ... }",
  "server_code": "const token = await getCredential('github'); ...",
  "server_code_enabled": true,
  "data_providers": ["github"],
  "default_size": { "w": 4, "h": 3 },
  "refresh_interval": 300
}
```

### Step 3: Add to Dashboard

```http
POST /api/widgets
Content-Type: application/json

{
  "type": "custom",
  "title": "GitHub PRs",
  "custom_widget_id": "cw_abc123",
  "config": { "owner": "acfranzen", "repo": "libra" }
}
```

## Widget Code Template

```tsx
function Widget() {
  const config = useConfig();
  const { data, loading, error, refresh } = useData('github', {});
  
  if (loading) return <Loading />;
  if (error) return <ErrorDisplay message={error.message} retry={refresh} />;
  
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Widget Title</CardTitle>
      </CardHeader>
      <CardContent>
        <List items={data.map(item => ({
          title: item.name,
          subtitle: item.description
        }))} />
      </CardContent>
    </Card>
  );
}
```

## Server Code Template

```javascript
const token = await getCredential('github');

const response = await fetch('https://api.github.com/repos/owner/repo/pulls', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json'
  }
});

if (!response.ok) {
  return { error: { code: 'API_ERROR', message: `API returned ${response.status}` }};
}

return await response.json();
```

**Available in server code:**
- `fetch` - HTTP requests
- `getCredential(provider)` - Get decrypted credential
- `params` - Parameters from widget config
- `console.log/warn/error` - Logging

**Blocked:** `require`, `eval`, `fs`, `process`, `global`

## Agent Refresh Contract

When `fetch.type = "agent_refresh"`, the agent MUST:

1. **Run on schedule** (cron expression in `fetch.schedule`)
2. **Push data to cache endpoint:**

```http
POST /api/custom-widgets/{slug}/cache
Content-Type: application/json

{
  "data": {
    "packages": 142,
    "fetchedAt": "2026-02-03T18:30:00.000Z"
  }
}
```

3. **Always include `fetchedAt`** timestamp
4. **Don't overwrite on errors** - let widget use stale data

### Agent Refresh Example

```javascript
// Cron: */15 * * * *
async function refreshHomebrew(slug) {
  const result = await exec('brew list --formula | wc -l');
  const count = parseInt(result.stdout.trim());
  
  await fetch(`${GLANCE_URL}/api/custom-widgets/${slug}/cache`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}` },
    body: JSON.stringify({
      data: { packageCount: count, fetchedAt: new Date().toISOString() }
    })
  });
}
```

## Credential Requirements Format

```json
{
  "credentials": [
    {
      "id": "github",
      "type": "api_key",
      "name": "GitHub Personal Access Token",
      "description": "Token with repo scope",
      "obtain_url": "https://github.com/settings/tokens",
      "obtain_instructions": "Create token with 'repo' scope"
    },
    {
      "id": "homebrew",
      "type": "local_software",
      "name": "Homebrew",
      "check_command": "which brew",
      "install_url": "https://brew.sh"
    }
  ]
}
```

## Common Credential Providers

| Provider | ID | Description |
|----------|-----|-------------|
| GitHub | `github` | GitHub API (PAT with repo scope) |
| Anthropic | `anthropic` | Claude API (Admin key for usage) |
| OpenAI | `openai` | GPT API (Admin key for usage) |
| OpenWeather | `openweather` | Weather data API |
| Linear | `linear` | Linear API |
| Notion | `notion` | Notion API |

## Export/Import Packages

### Export

```http
GET /api/custom-widgets/{slug}/export
```

Returns: `{ "package": "!GW1!eJxVj8EKwj..." }`

### Import

```http
POST /api/widget-packages/import
Content-Type: application/json

{
  "package": "!GW1!eJxVj8EKwj...",
  "dry_run": false,
  "auto_add_to_dashboard": true
}
```

The `!GW1!` prefix indicates Glance Widget v1 format (compressed base64 JSON).

### Import Response with Cron

```json
{
  "valid": true,
  "widget": { "id": "cw_abc", "slug": "homebrew-status" },
  "cronSchedule": {
    "expression": "*/15 * * * *",
    "instructions": "Run brew list...",
    "slug": "homebrew-status"
  }
}
```

When `cronSchedule` is returned, OpenClaw should register a cron job.

## Key UI Components

| Component | Use For |
|-----------|---------|
| `Card` | Widget container (always use `className="h-full"`) |
| `List` | Items with title/subtitle/badge |
| `Stat` | Single metric with trend indicator |
| `Progress` | Progress bars with variants |
| `Badge` | Status labels (success/warning/error) |
| `Stack` | Flexbox layout (row/column) |
| `Grid` | CSS Grid layout |
| `Loading` | Loading spinner |
| `ErrorDisplay` | Error with retry button |

See [references/components.md](references/components.md) for full props.

## Hooks

```tsx
// Fetch data (BOTH args required!)
const { data, loading, error, refresh } = useData('github', {});
const { data } = useData('github', { endpoint: '/pulls', params: { state: 'open' } });

// Get widget config
const config = useConfig();

// Widget-local state
const { state, setState } = useWidgetState('counter', 0);
```

**⚠️ `useData` requires both arguments.** Pass empty `{}` if no query needed.

## Error Handling

```tsx
if (error?.code === 'CREDENTIAL_MISSING') {
  return <Card><CardContent>
    <Icons.Lock className="h-8 w-8" />
    <p>GitHub token required</p>
  </CardContent></Card>;
}
```

Error codes: `CREDENTIAL_MISSING`, `RATE_LIMITED`, `NETWORK_ERROR`, `API_ERROR`

## Best Practices

1. **Always check credentials before creating widgets**
2. **Use meaningful names:** `github-prs-libra` not `widget-1`
3. **Include fetchedAt in all data** for staleness tracking
4. **Handle errors gracefully** with retry options
5. **Confirm actions:** "Done! Widget added to dashboard."
6. **Size appropriately:** Lists 1x1, charts 2x2

## Reading Dashboard Data

To summarize dashboard for user:

```
1. GET /api/widgets → list instances
2. For each: POST /api/custom-widgets/:slug/execute
3. Combine into natural language summary
```
