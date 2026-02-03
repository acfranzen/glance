# Glance Widget Components Reference

All components are pre-imported in the widget sandbox. Most are from [shadcn/ui](https://ui.shadcn.com/docs/components).

## Layout Components

### Card

Container for widget content.

```tsx
<Card className="h-full">
  <CardHeader>
    <CardTitle>Widget Title</CardTitle>
    <CardDescription>Optional description</CardDescription>
  </CardHeader>
  <CardContent>{/* Main content */}</CardContent>
  <CardFooter>{/* Optional footer */}</CardFooter>
</Card>
```

### Stack

Flexbox container.

```tsx
<Stack direction="row" gap={2} align="center" justify="between">
  <span>Left</span>
  <span>Right</span>
</Stack>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `direction` | `'row'` \| `'column'` | `'column'` | Flex direction |
| `gap` | number | `2` | Spacing multiplier |
| `align` | `'start'` \| `'center'` \| `'end'` \| `'stretch'` | - | Align items |
| `justify` | `'start'` \| `'center'` \| `'end'` \| `'between'` \| `'around'` | - | Justify content |
| `wrap` | boolean | - | Enable wrapping |

### Grid

CSS Grid container.

```tsx
<Grid cols={2} gap={3}>
  <Stat label="Metric 1" value={42} />
  <Stat label="Metric 2" value={100} />
</Grid>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `cols` | number | `2` | Number of columns |
| `gap` | number | `2` | Gap multiplier |

## Data Display Components

### Stat

Display a metric with optional trend.

```tsx
<Stat label="API Usage" value={72} suffix="%" change={5.2} trend="up" />
```

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `label` | string | Yes | Metric label |
| `value` | string \| number | Yes | Metric value |
| `prefix` | string | No | Value prefix (e.g., "$") |
| `suffix` | string | No | Value suffix (e.g., "%") |
| `change` | number | No | Percentage change |
| `trend` | `'up'` \| `'down'` \| `'neutral'` | No | Trend indicator |

### Progress

Progress bar with variants.

```tsx
<Progress value={72} max={100} showLabel variant="warning" />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | number | Required | Current value |
| `max` | number | `100` | Maximum value |
| `showLabel` | boolean | - | Show percentage label |
| `variant` | `'default'` \| `'success'` \| `'warning'` \| `'error'` | `'default'` | Color variant |
| `size` | `'sm'` \| `'md'` \| `'lg'` | `'md'` | Bar height |

### Badge

Status badges/labels.

```tsx
<Badge variant="success">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="error">Failed</Badge>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'default'` \| `'success'` \| `'warning'` \| `'error'` \| `'info'` | `'default'` | Color variant |

### List

Display items with optional badges.

```tsx
<List
  items={[
    { title: "Item 1", subtitle: "Description", badge: "New", badgeVariant: "info" },
    { title: "Item 2", subtitle: "Another item" }
  ]}
  emptyMessage="No items found"
/>
```

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `items` | `Array<{ title, subtitle?, badge?, badgeVariant? }>` | Yes | List items |
| `emptyMessage` | string | No | Message when empty |

### Avatar

User avatars with fallback.

```tsx
<Avatar>
  <AvatarImage src="https://github.com/user.png" />
  <AvatarFallback>JD</AvatarFallback>
</Avatar>
```

## State Components

### Loading

Loading spinner.

```tsx
<Loading message="Fetching data..." />
```

### ErrorDisplay

Error state with retry.

```tsx
<ErrorDisplay message="Failed to load data" retry={() => refresh()} />
```

### Empty

Empty state placeholder.

```tsx
<Empty message="No results found" />
```

## Form Components

### Button

```tsx
<Button onClick={handleClick} variant="outline" size="sm">
  Click me
</Button>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'default'` \| `'outline'` \| `'ghost'` \| `'link'` | `'default'` | Style variant |
| `size` | `'sm'` \| `'default'` \| `'lg'` | `'default'` | Button size |

### Input

```tsx
<Input placeholder="Enter value..." value={text} onChange={(e) => setText(e.target.value)} />
```

### Switch

```tsx
<Switch checked={enabled} onCheckedChange={setEnabled} />
```

### Label

```tsx
<Label htmlFor="input-id">Field Label</Label>
```

## Other Components

### Tabs

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

### Tooltip

```tsx
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger>Hover me</TooltipTrigger>
    <TooltipContent>Tooltip text</TooltipContent>
  </Tooltip>
</TooltipProvider>
```

### Separator

```tsx
<Separator className="my-4" />
```

## Icons

Available via `Icons` object. Subset of [Lucide React](https://lucide.dev/icons/).

```tsx
<Icons.GitPullRequest className="h-4 w-4" />
<Icons.Clock className="h-4 w-4 text-muted-foreground" />
```

**Available icons:**

| Category | Icons |
|----------|-------|
| Status | `Check`, `X`, `AlertCircle`, `AlertTriangle`, `Info` |
| Arrows | `ArrowUp`, `ArrowDown`, `ChevronRight` |
| Trends | `TrendingUp`, `TrendingDown` |
| Actions | `Edit`, `Copy`, `Download`, `Upload`, `Trash`, `Plus`, `Minus`, `RefreshCw`, `Search` |
| Common | `Clock`, `Eye`, `EyeOff`, `Lock`, `Unlock`, `Settings`, `Home`, `User` |
| Dev | `Code`, `GitPullRequest`, `Package`, `FileText` |
| UI | `MoreHorizontal`, `MoreVertical`, `ExternalLink`, `Loader2` |
| Social | `Heart`, `Star`, `Mail`, `MessageSquare`, `Globe` |
| Other | `Activity`, `BarChart2`, `Coffee`, `Zap` |

## Styling

Use Tailwind CSS classes via `className` prop:

```tsx
<Card className="h-full bg-gradient-to-br from-blue-50 to-indigo-50">
  <CardContent className="p-6">
    <span className="text-lg font-bold text-blue-600">Styled</span>
  </CardContent>
</Card>
```

Conditional classes with `cn()`:

```tsx
<div className={cn(
  "rounded-lg p-4",
  isActive && "bg-primary text-primary-foreground",
  !isActive && "bg-muted"
)}>
  Content
</div>
```
