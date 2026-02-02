# Widget SDK Documentation

The Glance Widget SDK enables AI assistants (and developers) to create custom widgets that display data from any API. Widgets are written in JSX/TSX and have access to a rich set of UI components and data-fetching hooks.

## Table of Contents

- [Quick Start](#quick-start)
- [Widget Creation API](#widget-creation-api)
- [Credential Management](#credential-management)
- [When to Use Server Code](#when-to-use-server-code)
- [Reading Widget Data](#reading-widget-data)
- [Components](#components)
- [Hooks](#hooks)
- [Server-Side Code](#server-side-code)
- [Icons](#icons)
- [Widget Lifecycle](#widget-lifecycle)
- [Error Handling Patterns](#error-handling-patterns)
- [Full API Reference](#full-api-reference)
- [OpenClaw Integration Guide](#openclaw-integration-guide)

---

## Quick Start

Here's a minimal widget that displays a greeting:

```tsx
function Widget() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Hello World</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Welcome to Glance!</p>
      </CardContent>
    </Card>
  );
}
```

A more practical widget that fetches data:

```tsx
function Widget() {
  const { data, loading, error } = useData('github', {
    endpoint: '/user/repos',
    params: { sort: 'updated', per_page: 5 }
  });

  if (loading) return <Loading />;
  if (error) return <ErrorDisplay message={error.message} />;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>My Repos</CardTitle>
      </CardHeader>
      <CardContent>
        <List
          items={data.map(repo => ({
            title: repo.name,
            subtitle: repo.description,
            badge: repo.private ? 'Private' : 'Public'
          }))}
        />
      </CardContent>
    </Card>
  );
}
```

---

## Widget Creation API

Widgets are managed through the REST API. All endpoints require authentication via Bearer token.

### Create a Widget

```http
POST /api/custom-widgets
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "GitHub PRs",
  "slug": "github-prs",
  "source_code": "function Widget() { return <Card>...</Card>; }",
  "server_code": "const token = await getCredential('github'); ...",
  "config": { "owner": "acfranzen", "repo": "glance" },
  "position_x": 0,
  "position_y": 0,
  "width": 1,
  "height": 1
}
```

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Display name for the widget |
| `slug` | string | Yes | Unique identifier (lowercase, hyphens allowed) |
| `source_code` | string | Yes | JSX/TSX widget code (must export `Widget` function) |
| `server_code` | string | No | Server-side code for secure API calls |
| `config` | object | No | Configuration object accessible via `useConfig()` |
| `position_x` | number | No | Grid X position (default: auto-placed) |
| `position_y` | number | No | Grid Y position (default: auto-placed) |
| `width` | number | No | Width in grid units (default: 1) |
| `height` | number | No | Height in grid units (default: 1) |

**Response (201 Created):**

```json
{
  "id": "cuid_abc123",
  "name": "GitHub PRs",
  "slug": "github-prs",
  "source_code": "function Widget() { ... }",
  "server_code": "const token = ...",
  "config": { "owner": "acfranzen", "repo": "glance" },
  "position_x": 0,
  "position_y": 0,
  "width": 1,
  "height": 1,
  "created_at": "2026-02-01T12:00:00.000Z",
  "updated_at": "2026-02-01T12:00:00.000Z"
}
```

### Get All Widgets

```http
GET /api/custom-widgets
Authorization: Bearer <token>
```

**Response (200 OK):**

```json
{
  "widgets": [
    {
      "id": "cuid_abc123",
      "name": "GitHub PRs",
      "slug": "github-prs",
      "config": { "owner": "acfranzen", "repo": "glance" },
      "position_x": 0,
      "position_y": 0,
      "width": 1,
      "height": 1,
      "created_at": "2026-02-01T12:00:00.000Z",
      "updated_at": "2026-02-01T12:00:00.000Z"
    }
  ]
}
```

### Get a Single Widget

```http
GET /api/custom-widgets/:id
Authorization: Bearer <token>
```

**Response (200 OK):**

```json
{
  "id": "cuid_abc123",
  "name": "GitHub PRs",
  "slug": "github-prs",
  "source_code": "function Widget() { ... }",
  "server_code": "const token = ...",
  "config": { "owner": "acfranzen", "repo": "glance" },
  "position_x": 0,
  "position_y": 0,
  "width": 1,
  "height": 1,
  "created_at": "2026-02-01T12:00:00.000Z",
  "updated_at": "2026-02-01T12:00:00.000Z"
}
```

### Update a Widget

```http
PUT /api/custom-widgets/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "GitHub PRs (Updated)",
  "source_code": "function Widget() { ... }",
  "config": { "owner": "acfranzen", "repo": "glance", "show_drafts": true }
}
```

All fields are optional. Only provided fields will be updated.

**Response (200 OK):** Returns the updated widget object.

### Delete a Widget

```http
DELETE /api/custom-widgets/:id
Authorization: Bearer <token>
```

**Response (204 No Content)**

---

## Credential Management

Credentials store API keys and tokens securely for use in server-side widget code. All credentials are encrypted at rest and only decrypted when accessed via `getCredential()` in server code.

### Store a Credential

```http
POST /api/credentials
Authorization: Bearer <token>
Content-Type: application/json

{
  "key": "github",
  "value": "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

**Response (201 Created):**

```json
{
  "key": "github",
  "created_at": "2026-02-01T12:00:00.000Z"
}
```

**Note:** The value is never returned after storage.

### List Credentials

```http
GET /api/credentials
Authorization: Bearer <token>
```

**Response (200 OK):**

```json
{
  "credentials": [
    { "key": "github", "created_at": "2026-02-01T12:00:00.000Z" },
    { "key": "openweather", "created_at": "2026-02-01T12:00:00.000Z" },
    { "key": "anthropic", "created_at": "2026-02-01T12:00:00.000Z" }
  ]
}
```

### Get a Credential

```http
GET /api/credentials/:key
Authorization: Bearer <token>
```

**Response (200 OK):**

```json
{
  "key": "github",
  "value": "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "created_at": "2026-02-01T12:00:00.000Z"
}
```

**⚠️ Security Note:** This endpoint returns the decrypted value. Use sparingly and only when necessary.

### Delete a Credential

```http
DELETE /api/credentials/:key
Authorization: Bearer <token>
```

**Response (204 No Content)**

### Naming Conventions

Use lowercase provider names as credential keys:

| Provider | Key |
|----------|-----|
| GitHub | `github` |
| Anthropic | `anthropic` |
| OpenWeather | `openweather` |
| OpenAI | `openai` |
| Notion | `notion` |
| Linear | `linear` |

### Best Practices

1. **Check before creating widgets:** Always verify required credentials exist before creating a widget that depends on them.

2. **Prompt users for missing credentials:** If a credential is missing, ask the user to provide it rather than failing silently.

3. **Use descriptive error messages:** When a credential is missing, tell the user exactly which credential is needed and how to provide it.

```typescript
// Example: Check if credential exists before creating widget
const credentials = await fetch('/api/credentials', { headers: { Authorization: `Bearer ${token}` } });
const credentialKeys = credentials.map(c => c.key);

if (!credentialKeys.includes('github')) {
  // Prompt user for GitHub token
  throw new Error('GitHub token required. Please provide your GitHub personal access token.');
}
```

---

## When to Use Server Code

Deciding between client-side `useData` and server-side code depends on your data source and security requirements.

### Decision Tree

```
Does the API require authentication (API key, OAuth token)?
├── YES → Use server code
└── NO
    └── Are you handling any secrets or tokens?
        ├── YES → Use server code
        └── NO
            └── Do you need to transform, aggregate, or combine data from multiple sources?
                ├── YES → Server code is recommended (cleaner, faster)
                └── NO → Client-side useData is fine
```

### When to Use Server Code

- **Authenticated APIs:** GitHub, Anthropic, OpenAI, Notion, Linear—any API requiring tokens
- **Secret handling:** Even if an API is public, if you're using API keys for rate limits
- **Data transformation:** Combining multiple API calls, filtering, or reshaping data
- **Rate limit management:** Server code can implement caching or throttling
- **Sensitive business logic:** Code you don't want exposed in the browser

### When Client-Side is Fine

- **Public APIs:** Open data sources with no authentication
- **Static data:** Configuration or display-only widgets
- **Simple displays:** Widgets that just render provided config data

### Examples

**✅ Use server code:**
```javascript
// GitHub PR fetching with authentication
const token = await getCredential('github');
const response = await fetch('https://api.github.com/repos/owner/repo/pulls', {
  headers: { Authorization: `Bearer ${token}` }
});
return response.json();
```

**✅ Use client-side:**
```tsx
// Simple counter widget - no external data
function Widget() {
  const { state, setState } = useWidgetState('count', 0);
  return <Button onClick={() => setState(state + 1)}>{state}</Button>;
}
```

---

## Reading Widget Data

OpenClaw agents can read widget data to understand what's displayed on the dashboard and summarize it for users.

### Get Widget Data

Returns the current data state of a widget (the result of its last server code execution or data fetch).

```http
GET /api/custom-widgets/:id/data
Authorization: Bearer <token>
```

**Response (200 OK):**

```json
{
  "widget_id": "cuid_abc123",
  "data": {
    "prs": [
      { "number": 42, "title": "Add new feature", "author": "octocat" },
      { "number": 41, "title": "Fix bug", "author": "developer" }
    ],
    "fetchedAt": "2026-02-01T12:00:00.000Z"
  },
  "last_updated": "2026-02-01T12:00:00.000Z",
  "error": null
}
```

If the widget has an error:

```json
{
  "widget_id": "cuid_abc123",
  "data": null,
  "last_updated": "2026-02-01T12:00:00.000Z",
  "error": {
    "message": "GitHub API rate limit exceeded",
    "code": "RATE_LIMITED"
  }
}
```

### Force Execute Server Code

Triggers an immediate re-execution of the widget's server code, bypassing any cache.

```http
POST /api/custom-widgets/:id/execute
Authorization: Bearer <token>
```

**Response (200 OK):**

```json
{
  "widget_id": "cuid_abc123",
  "data": { ... },
  "executed_at": "2026-02-01T12:00:00.000Z"
}
```

### How OpenClaw Uses Widget Data

OpenClaw agents can "read the dashboard" by:

1. **Listing all widgets:** `GET /api/custom-widgets` to see what's displayed
2. **Reading each widget's data:** `GET /api/custom-widgets/:id/data` for current state
3. **Summarizing for users:** Convert the raw data into natural language

**Example agent flow:**

```
User: "What's on my dashboard?"

Agent:
1. GET /api/custom-widgets → [github-prs, weather, api-usage]
2. GET /api/custom-widgets/github-prs/data → { prs: [...] }
3. GET /api/custom-widgets/weather/data → { temp: 72, conditions: "sunny" }
4. GET /api/custom-widgets/api-usage/data → { used: 45, limit: 100 }

Response: "Your dashboard shows:
- 3 open PRs on github/glance (newest: 'Add widget SDK docs' by zeus)
- Weather in SF: 72°F and sunny
- API usage: 45% of monthly limit"
```

---

## Components

All components are pre-imported and available in the widget sandbox.

### Layout Components

#### Card

Container for widget content. Use with `CardHeader`, `CardContent`, `CardFooter`, `CardTitle`, and `CardDescription`.

```tsx
<Card className="h-full">
  <CardHeader>
    <CardTitle>Widget Title</CardTitle>
    <CardDescription>Optional description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Main content */}
  </CardContent>
  <CardFooter>
    {/* Optional footer */}
  </CardFooter>
</Card>
```

#### Stack

Flexbox container for arranging items.

```tsx
<Stack direction="row" gap={2} align="center" justify="between">
  <span>Left</span>
  <span>Right</span>
</Stack>
```

Props:
- `direction`: `'row'` | `'column'` (default: `'column'`)
- `gap`: number (spacing multiplier, default: `2`)
- `align`: `'start'` | `'center'` | `'end'` | `'stretch'`
- `justify`: `'start'` | `'center'` | `'end'` | `'between'` | `'around'`
- `wrap`: boolean

#### Grid

CSS Grid container.

```tsx
<Grid cols={2} gap={3}>
  <Stat label="Metric 1" value={42} />
  <Stat label="Metric 2" value={100} />
</Grid>
```

Props:
- `cols`: number (default: `2`)
- `gap`: number (default: `2`)

### Data Display Components

#### Stat

Display a metric with optional trend indicator.

```tsx
<Stat 
  label="API Usage" 
  value={72} 
  suffix="%" 
  change={5.2} 
  trend="up" 
/>
```

Props:
- `label`: string (required)
- `value`: string | number (required)
- `prefix`: string (e.g., "$")
- `suffix`: string (e.g., "%")
- `change`: number (percentage change)
- `trend`: `'up'` | `'down'` | `'neutral'`

#### Progress

Progress bar with variants.

```tsx
<Progress value={72} max={100} showLabel variant="warning" />
```

Props:
- `value`: number (required)
- `max`: number (default: `100`)
- `showLabel`: boolean (show percentage label)
- `variant`: `'default'` | `'success'` | `'warning'` | `'error'`
- `size`: `'sm'` | `'md'` | `'lg'`

#### Badge

Status badges/labels.

```tsx
<Badge variant="success">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="error">Failed</Badge>
```

Props:
- `variant`: `'default'` | `'success'` | `'warning'` | `'error'` | `'info'`

#### List

Display a list of items with optional badges.

```tsx
<List
  items={[
    { title: 'Item 1', subtitle: 'Description', badge: 'New', badgeVariant: 'info' },
    { title: 'Item 2', subtitle: 'Another item' }
  ]}
  emptyMessage="No items found"
/>
```

Props:
- `items`: Array of `{ title, subtitle?, badge?, badgeVariant? }`
- `emptyMessage`: string

#### Avatar

User avatars with fallback.

```tsx
<Avatar>
  <AvatarImage src="https://github.com/user.png" />
  <AvatarFallback>JD</AvatarFallback>
</Avatar>
```

### State Components

#### Loading

Loading spinner with optional message.

```tsx
<Loading message="Fetching data..." />
```

#### ErrorDisplay

Error state with optional retry button.

```tsx
<ErrorDisplay message="Failed to load data" retry={() => refresh()} />
```

#### Empty

Empty state placeholder.

```tsx
<Empty message="No results found" />
```

### Form Components

#### Button

Standard button component.

```tsx
<Button onClick={handleClick} variant="outline" size="sm">
  Click me
</Button>
```

#### Input

Text input field.

```tsx
<Input placeholder="Enter value..." value={text} onChange={e => setText(e.target.value)} />
```

#### Label

Form label.

```tsx
<Label htmlFor="input-id">Field Label</Label>
```

#### Switch

Toggle switch.

```tsx
<Switch checked={enabled} onCheckedChange={setEnabled} />
```

### Other Components

#### Tabs

Tabbed content.

```tsx
<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Content 1</TabsContent>
  <TabsContent value="tab2">Content 2</TabsContent>
</Tabs>
```

#### Tooltip

Hover tooltips.

```tsx
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger>Hover me</TooltipTrigger>
    <TooltipContent>Tooltip text</TooltipContent>
  </Tooltip>
</TooltipProvider>
```

#### Separator

Visual divider.

```tsx
<Separator className="my-4" />
```

---

## Hooks

### useData

Fetch data from a configured data provider.

```tsx
const { data, loading, error, refresh } = useData<ResponseType>(provider, query);
```

Parameters:
- `provider`: string - The data provider slug (e.g., `'github'`, `'anthropic'`)
- `query`: object
  - `endpoint`: string - API endpoint path
  - `params`: object - Query parameters
  - `method`: `'GET'` | `'POST'` (default: `'GET'`)
  - `body`: object - Request body for POST requests

Returns:
- `data`: T | null - The response data
- `loading`: boolean - Loading state
- `error`: Error | null - Error if request failed
- `refresh`: () => void - Function to manually refresh data

Example:

```tsx
const { data, loading, error, refresh } = useData<PullRequest[]>('github', {
  endpoint: '/repos/anthropics/claude-code/pulls',
  params: { state: 'open', per_page: 10 }
});
```

### useConfig

Access the widget's configuration.

```tsx
const config = useConfig();
const apiKey = config.apiKey;
const threshold = config.threshold || 80;
```

### useWidgetState

Manage widget-local state.

```tsx
const { state, setState } = useWidgetState<number>('counter', 0);

// Update state
setState(state + 1);
setState(prev => prev + 1);
```

---

## Server-Side Code

For advanced use cases, widgets can execute server-side code to fetch or process data. This is useful when you need to:

- Make authenticated API calls without exposing credentials to the browser
- Process or transform data before sending to the client
- Access credentials securely via `getCredential()`

### Writing Server Code

Server code runs in a sandboxed Node.js VM with limited capabilities:

```javascript
// Server code example
const token = await getCredential('github');

const response = await fetch('https://api.github.com/user', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json'
  }
});

const user = await response.json();
return { user, fetchedAt: new Date().toISOString() };
```

### Available in Server Code

- `fetch` - Make HTTP requests
- `getCredential(provider)` - Get decrypted credential for a provider
- `params` - Parameters passed from the widget
- `console.log/warn/error` - Logging (prefixed with `[server-code]`)
- Standard JS built-ins: `JSON`, `Date`, `Math`, `Array`, `Object`, `Promise`, `Map`, `Set`, etc.

### Blocked in Server Code

For security, the following are blocked:

- `require()` / `import` - No module loading
- `eval()` / `new Function()` - No dynamic code execution
- `process` / `Buffer` - No Node.js process access
- `fs` / `child_process` - No filesystem or shell access
- `global` / `globalThis` - No global object access

### Accessing Server Data in Widget

When server code is enabled, `useData` automatically routes through the server executor:

```tsx
function Widget() {
  // This will execute your server code instead of direct API call
  const { data, loading, error } = useData('github', {
    endpoint: '/custom', // Can be anything - server code controls the actual request
    params: { owner: 'anthropics', repo: 'claude-code' }
  });
  
  // ...
}
```

---

## Icons

A curated set of Lucide icons is available via the `Icons` object:

```tsx
<Icons.GitPullRequest className="h-4 w-4" />
<Icons.Clock className="h-4 w-4 text-muted-foreground" />
```

Available icons:

| Icon | Name |
|------|------|
| Activity | `Icons.Activity` |
| AlertCircle | `Icons.AlertCircle` |
| AlertTriangle | `Icons.AlertTriangle` |
| ArrowDown | `Icons.ArrowDown` |
| ArrowUp | `Icons.ArrowUp` |
| BarChart2 | `Icons.BarChart2` |
| Check | `Icons.Check` |
| ChevronRight | `Icons.ChevronRight` |
| Clock | `Icons.Clock` |
| Code | `Icons.Code` |
| Coffee | `Icons.Coffee` |
| Copy | `Icons.Copy` |
| Download | `Icons.Download` |
| Edit | `Icons.Edit` |
| ExternalLink | `Icons.ExternalLink` |
| Eye | `Icons.Eye` |
| EyeOff | `Icons.EyeOff` |
| FileText | `Icons.FileText` |
| GitPullRequest | `Icons.GitPullRequest` |
| Globe | `Icons.Globe` |
| Heart | `Icons.Heart` |
| Home | `Icons.Home` |
| Info | `Icons.Info` |
| Loader2 | `Icons.Loader2` |
| Lock | `Icons.Lock` |
| Mail | `Icons.Mail` |
| MessageSquare | `Icons.MessageSquare` |
| Minus | `Icons.Minus` |
| MoreHorizontal | `Icons.MoreHorizontal` |
| MoreVertical | `Icons.MoreVertical` |
| Package | `Icons.Package` |
| Plus | `Icons.Plus` |
| RefreshCw | `Icons.RefreshCw` |
| Search | `Icons.Search` |
| Settings | `Icons.Settings` |
| Star | `Icons.Star` |
| Trash | `Icons.Trash` |
| TrendingDown | `Icons.TrendingDown` |
| TrendingUp | `Icons.TrendingUp` |
| Unlock | `Icons.Unlock` |
| Upload | `Icons.Upload` |
| User | `Icons.User` |
| X | `Icons.X` |
| Zap | `Icons.Zap` |

---

## Widget Lifecycle

### Creating a Widget

1. **Check credentials:** Verify any required credentials exist
2. **Create the widget:** POST to `/api/custom-widgets`
3. **Verify creation:** Widget appears on dashboard immediately

```http
POST /api/custom-widgets
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Widget",
  "slug": "my-widget",
  "source_code": "function Widget() { return <Card><CardContent>Hello!</CardContent></Card>; }",
  "width": 1,
  "height": 1
}
```

### Updating a Widget

Use PUT to update any widget fields. Only include fields you want to change.

```http
PUT /api/custom-widgets/cuid_abc123
Authorization: Bearer <token>
Content-Type: application/json

{
  "source_code": "function Widget() { return <Card><CardContent>Updated!</CardContent></Card>; }",
  "config": { "showDetails": true }
}
```

Common update scenarios:
- **Fix bugs:** Update `source_code` or `server_code`
- **Change settings:** Update `config` object
- **Resize:** Update `width` and/or `height`
- **Reposition:** Update `position_x` and/or `position_y`
- **Rename:** Update `name` (slug cannot be changed)

### Deleting a Widget

```http
DELETE /api/custom-widgets/cuid_abc123
Authorization: Bearer <token>
```

The widget is immediately removed from the dashboard. This action cannot be undone.

---

## Error Handling Patterns

Widgets should handle errors gracefully and provide helpful feedback to users.

### Missing Credentials

```tsx
function Widget() {
  const { data, loading, error } = useData('github', { endpoint: '/user' });

  if (error?.code === 'CREDENTIAL_MISSING') {
    return (
      <Card className="h-full">
        <CardContent className="flex flex-col items-center justify-center h-full gap-4">
          <Icons.Lock className="h-8 w-8 text-muted-foreground" />
          <div className="text-center">
            <p className="font-medium">GitHub token required</p>
            <p className="text-sm text-muted-foreground">
              Add your GitHub personal access token in Settings → Credentials
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ... rest of widget
}
```

### API Rate Limits

```tsx
if (error?.code === 'RATE_LIMITED') {
  const retryAfter = error.retryAfter || 60;
  return (
    <Card className="h-full">
      <CardContent className="flex flex-col items-center justify-center h-full gap-4">
        <Icons.Clock className="h-8 w-8 text-warning" />
        <div className="text-center">
          <p className="font-medium">Rate limit exceeded</p>
          <p className="text-sm text-muted-foreground">
            Try again in {Math.ceil(retryAfter / 60)} minutes
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Network Failures

```tsx
if (error?.code === 'NETWORK_ERROR') {
  return (
    <Card className="h-full">
      <CardContent className="flex flex-col items-center justify-center h-full gap-4">
        <Icons.AlertCircle className="h-8 w-8 text-destructive" />
        <div className="text-center">
          <p className="font-medium">Connection failed</p>
          <p className="text-sm text-muted-foreground">
            Check your internet connection
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          <Icons.RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}
```

### Generic Error with Retry

```tsx
function Widget() {
  const { data, loading, error, refresh } = useData('api', { endpoint: '/data' });

  if (loading) return <Loading />;
  
  if (error) {
    return (
      <ErrorDisplay 
        message={error.message || 'Something went wrong'} 
        retry={refresh} 
      />
    );
  }

  // ... render data
}
```

### Server Code Error Handling

```javascript
// In server code - return structured errors
try {
  const token = await getCredential('github');
  if (!token) {
    return { error: { code: 'CREDENTIAL_MISSING', message: 'GitHub token not found' } };
  }

  const response = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (response.status === 401) {
    return { error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } };
  }

  if (response.status === 403 && response.headers.get('X-RateLimit-Remaining') === '0') {
    const resetTime = response.headers.get('X-RateLimit-Reset');
    return { 
      error: { 
        code: 'RATE_LIMITED', 
        message: 'Rate limit exceeded',
        retryAfter: parseInt(resetTime) - Math.floor(Date.now() / 1000)
      } 
    };
  }

  if (!response.ok) {
    return { error: { code: 'API_ERROR', message: `API returned ${response.status}` } };
  }

  return await response.json();
} catch (e) {
  return { error: { code: 'NETWORK_ERROR', message: e.message } };
}
```

---

## Full API Reference

### Widget Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/custom-widgets` | List all widgets | Bearer token |
| `POST` | `/api/custom-widgets` | Create a new widget | Bearer token |
| `GET` | `/api/custom-widgets/:id` | Get a single widget | Bearer token |
| `PUT` | `/api/custom-widgets/:id` | Update a widget | Bearer token |
| `DELETE` | `/api/custom-widgets/:id` | Delete a widget | Bearer token |
| `GET` | `/api/custom-widgets/:id/data` | Get widget's current data | Bearer token |
| `POST` | `/api/custom-widgets/:id/execute` | Force re-execute server code | Bearer token |

### Credential Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/credentials` | List all credential keys | Bearer token |
| `POST` | `/api/credentials` | Store a new credential | Bearer token |
| `GET` | `/api/credentials/:key` | Get credential value (decrypted) | Bearer token |
| `DELETE` | `/api/credentials/:key` | Delete a credential | Bearer token |

### Response Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created |
| `204` | No Content (successful deletion) |
| `400` | Bad Request (invalid input) |
| `401` | Unauthorized (missing/invalid token) |
| `404` | Not Found |
| `409` | Conflict (duplicate slug/key) |
| `429` | Rate Limited |
| `500` | Internal Server Error |

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Widget slug already exists",
    "details": {
      "field": "slug",
      "value": "github-prs"
    }
  }
}
```

---

## OpenClaw Integration Guide

This section describes how OpenClaw agents should interact with Glance to create and manage widgets on behalf of users.

### Step 1: Parse User Request

When a user asks for a widget, extract the key information:

```
User: "Show me open PRs for the libra and glance repos"

Extract:
- Widget type: GitHub PRs
- Repos: ["acfranzen/libra", "acfranzen/glance"]
- Could be: Two separate widgets OR one combined widget
```

### Step 2: Check Required Credentials

Before creating any widget that needs authentication, verify credentials exist:

```http
GET /api/credentials
Authorization: Bearer <token>
```

Check if the required credential key is in the response.

### Step 3: Handle Missing Credentials

If a required credential is missing, ask the user to provide it:

```
Agent: "I need a GitHub personal access token to show PR data. 
You can create one at https://github.com/settings/tokens with 'repo' scope.
Once you have it, just paste it here and I'll store it securely."

User: "ghp_xxxxxxxxxxxx"

Agent: [stores credential via POST /api/credentials]
```

```http
POST /api/credentials
Authorization: Bearer <token>
Content-Type: application/json

{
  "key": "github",
  "value": "ghp_xxxxxxxxxxxx"
}
```

### Step 4: Create the Widget

Build and submit the widget with appropriate source and server code:

```http
POST /api/custom-widgets
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Libra PRs",
  "slug": "libra-prs",
  "source_code": "function Widget() {\n  const { data, loading, error, refresh } = useData('github', { endpoint: '/pulls' });\n  if (loading) return <Loading />;\n  if (error) return <ErrorDisplay message={error.message} retry={refresh} />;\n  return (\n    <Card className=\"h-full\">\n      <CardHeader>\n        <Stack direction=\"row\" align=\"center\" gap={2}>\n          <Icons.GitPullRequest className=\"h-4 w-4\" />\n          <CardTitle>Libra PRs</CardTitle>\n        </Stack>\n      </CardHeader>\n      <CardContent>\n        <List items={data.map(pr => ({ title: pr.title, subtitle: `#${pr.number} by ${pr.user.login}` }))} emptyMessage=\"No open PRs\" />\n      </CardContent>\n    </Card>\n  );\n}",
  "server_code": "const token = await getCredential('github');\nconst response = await fetch('https://api.github.com/repos/acfranzen/libra/pulls?state=open', {\n  headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }\n});\nreturn response.json();",
  "config": { "owner": "acfranzen", "repo": "libra" },
  "width": 1,
  "height": 1
}
```

### Step 5: Confirm to User

```
Agent: "Done! I've added a Libra PRs widget to your dashboard. 
It's showing 3 open pull requests right now."
```

### Step 6: Read Widget Data on Heartbeats

During periodic heartbeats, OpenClaw can check widget data and summarize:

```http
GET /api/custom-widgets
Authorization: Bearer <token>
```

For each relevant widget:

```http
GET /api/custom-widgets/cuid_abc123/data
Authorization: Bearer <token>
```

Then summarize proactively if there's something notable:

```
Agent: "Quick update - you have 2 new PRs on Libra since yesterday, 
and one of your older PRs just got approved."
```

### Example Conversation Flow

```
User: "Can you add a widget showing my GitHub PRs?"

Agent: [Checks GET /api/credentials]
Agent: "I see you already have a GitHub token saved. Which repos 
       would you like to track? I can do one widget per repo or 
       combine them."

User: "Just libra for now"

Agent: [Creates widget via POST /api/custom-widgets]
Agent: "Done! Your Libra PRs widget is live. You currently have 
       2 open PRs:
       - #142: 'Add credential management' (opened 2 days ago)
       - #139: 'Fix widget rendering' (opened 5 days ago)"

User: "Actually make it show both libra and glance"

Agent: [Updates widget via PUT /api/custom-widgets/:id OR creates second widget]
Agent: "Updated! Now showing PRs from both repos."

--- Later, on heartbeat ---

Agent: "Hey, PR #142 on Libra just got merged! 🎉"
```

### Best Practices for OpenClaw Agents

1. **Always check credentials first** - Don't attempt to create authenticated widgets without verifying tokens exist

2. **Provide clear instructions** - When asking for credentials, explain exactly what's needed and where to get it

3. **Use meaningful names and slugs** - `github-prs-libra` is better than `widget-1`

4. **Handle errors gracefully** - If widget creation fails, explain why and offer to fix it

5. **Proactively summarize** - On heartbeats, read widget data and surface interesting changes

6. **Respect user preferences** - Ask before creating multiple widgets; some users prefer combined views

7. **Clean up unused widgets** - Offer to remove widgets that are no longer needed

---

## Styling

All components support a `className` prop for custom styling. Glance uses Tailwind CSS, so you can use any Tailwind utility classes:

```tsx
<Card className="h-full bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
  <CardContent className="p-6">
    <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
      Styled content
    </span>
  </CardContent>
</Card>
```

The `cn()` utility is available for conditional class merging:

```tsx
<div className={cn(
  'rounded-lg p-4',
  isActive && 'bg-primary text-primary-foreground',
  !isActive && 'bg-muted'
)}>
  Content
</div>
```

---

## Examples

### GitHub Pull Requests Widget

```tsx
function Widget() {
  const config = useConfig();
  const owner = config.owner || 'anthropics';
  const repo = config.repo || 'claude-code';

  const { data, loading, error, refresh } = useData('github', {
    endpoint: `/repos/${owner}/${repo}/pulls`,
    params: { state: 'open', per_page: 5 }
  });

  if (loading) return <Loading message="Loading PRs..." />;
  if (error) return <ErrorDisplay message={error.message} retry={refresh} />;

  const prs = data || [];

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <Stack direction="row" align="center" justify="between">
          <Stack direction="row" align="center" gap={2}>
            <Icons.GitPullRequest className="h-4 w-4" />
            <CardTitle className="text-sm">Open PRs</CardTitle>
          </Stack>
          <Badge>{prs.length}</Badge>
        </Stack>
      </CardHeader>
      <CardContent>
        <List
          items={prs.map(pr => ({
            title: pr.title,
            subtitle: `#${pr.number} by ${pr.user.login}`,
            badge: pr.draft ? 'Draft' : undefined,
            badgeVariant: 'info'
          }))}
          emptyMessage="No open PRs"
        />
      </CardContent>
    </Card>
  );
}
```

### API Usage Widget

```tsx
function Widget() {
  const { data, loading, error } = useData('anthropic', {
    endpoint: '/usage'
  });

  if (loading) return <Loading />;
  if (error) return <ErrorDisplay message={error.message} />;

  const usage = data || { used: 0, limit: 100 };
  const percent = (usage.used / usage.limit) * 100;
  const variant = percent > 90 ? 'error' : percent > 75 ? 'warning' : 'default';

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>API Usage</CardTitle>
      </CardHeader>
      <CardContent>
        <Stack gap={4}>
          <Stat 
            label="Current Usage" 
            value={percent.toFixed(1)} 
            suffix="%" 
            trend={percent > 75 ? 'up' : 'neutral'}
          />
          <Progress value={percent} variant={variant} showLabel />
          <p className="text-xs text-muted-foreground">
            ${usage.used.toFixed(2)} of ${usage.limit.toFixed(2)} used
          </p>
        </Stack>
      </CardContent>
    </Card>
  );
}
```

### Weather Widget (with Server Code)

Widget code:

```tsx
function Widget() {
  const config = useConfig();
  const { data, loading, error } = useData('weather', {
    endpoint: '/current',
    params: { city: config.city || 'San Francisco' }
  });

  if (loading) return <Loading message="Checking weather..." />;
  if (error) return <ErrorDisplay message={error.message} />;

  return (
    <Card className="h-full">
      <CardHeader>
        <Stack direction="row" align="center" gap={2}>
          <Icons.Globe className="h-4 w-4" />
          <CardTitle>{data.city}</CardTitle>
        </Stack>
      </CardHeader>
      <CardContent>
        <Stack gap={3}>
          <Stat label="Temperature" value={data.temp} suffix="°F" />
          <p className="text-sm text-muted-foreground">{data.conditions}</p>
        </Stack>
      </CardContent>
    </Card>
  );
}
```

Server code:

```javascript
const apiKey = await getCredential('openweather');
const city = params.city || 'San Francisco';

const response = await fetch(
  `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=imperial`
);

const weather = await response.json();

return {
  city: weather.name,
  temp: Math.round(weather.main.temp),
  conditions: weather.weather[0].description
};
```
