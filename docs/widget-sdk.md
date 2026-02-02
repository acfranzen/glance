# Widget SDK Documentation

The Glance Widget SDK enables AI assistants (and developers) to create custom widgets that display data from any API. Widgets are written in JSX/TSX and have access to a rich set of UI components and data-fetching hooks.

## Table of Contents

- [Quick Start](#quick-start)
- [Components](#components)
- [Hooks](#hooks)
- [Server-Side Code](#server-side-code)
- [Icons](#icons)
- [Examples](#examples)

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
