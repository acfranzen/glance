# GitHub PRs Widget

Shows open pull requests from the `acfranzen/libra` and `acfranzen/glance` repositories.

## Features

- ✅ Fetches open PRs from both repos via GitHub CLI
- ✅ Displays PR title, author, repo name, and when it was opened
- ✅ Links to PR on GitHub (external link)
- ✅ Shows count badge for total open PRs
- ✅ Has refresh button for manual updates
- ✅ Auto-polls every 5 minutes
- ✅ 5-minute cache for API responses
- ✅ Error handling with graceful fallbacks
- ✅ Matches Glance widget styling patterns

## Files Created

1. **Widget Component**: `src/components/widgets/GitHubPRsWidget.tsx`
   - React component with polling, loading, and error states
   - Displays PRs in a scrollable list with repo badges
   - Refresh button with loading indicator

2. **API Route**: `src/app/api/widgets/github-prs/data/route.ts`
   - Fetches PRs from both repos using `gh` CLI
   - Caches responses for 5 minutes in `/tmp/github-prs-cache.json`
   - Returns formatted PR data with relative timestamps

3. **Type Definitions**: Updated `src/types/widget.ts`
   - Added `github_prs` to WidgetType union
   - Added widget definition to WIDGET_DEFINITIONS array

4. **Widget Registry**: Updated `src/components/widgets/index.ts`
   - Exported GitHubPRsWidget

5. **Dashboard Integration**: Updated `src/components/dashboard/DashboardGrid.tsx`
   - Added case for 'github_prs' widget type
   - Imports and renders GitHubPRsWidget

6. **Widget Store**: Updated `src/lib/store/widget-store.ts`
   - Added default size for github_prs widget (4x4)

7. **Add Widget Modal**: Updated `src/components/dashboard/AddWidgetModal.tsx`
   - Added GitPullRequest icon to iconMap

## Usage

### Via UI
1. Open Glance dashboard at http://localhost:3333
2. Click "Add Widget" button
3. Select "GitHub PRs" from the widget list
4. Widget will appear on the dashboard

### Via API
```bash
curl -X POST http://localhost:3333/api/widgets \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3333" \
  -d '{
    "type": "github_prs",
    "title": "GitHub PRs",
    "config": {},
    "position": { "x": 0, "y": 0, "w": 4, "h": 4 }
  }'
```

### Refresh Data
```bash
curl -H "Origin: http://localhost:3333" \
  http://localhost:3333/api/widgets/github-prs/data?refresh=true
```

## Requirements

- GitHub CLI (`gh`) must be installed and authenticated
- Default path: `/opt/homebrew/bin/gh` (configurable via `GH_PATH` env var)
- Must have read access to `acfranzen/libra` and `acfranzen/glance` repos

## Configuration

The widget can be configured by setting environment variables:

- `GH_PATH`: Path to gh CLI binary (default: `/opt/homebrew/bin/gh`)

## Cache Behavior

- Cache file: `/tmp/github-prs-cache.json`
- Cache TTL: 5 minutes
- Falls back to stale cache on API errors
- Manual refresh bypasses cache (refresh button or `?refresh=true` param)

## Styling

The widget follows Glance's design patterns:
- Uses existing component patterns from UnreadEmailsWidget and ClaudeMaxUsageWidget
- Lucide icons (GitPullRequest, RefreshCw, ExternalLink)
- Responsive text truncation for long titles
- Repo-specific color badges (purple for libra, blue for glance)
- Relative timestamps (e.g., "2h ago", "3d ago")
- Hover effects on PR links
- Loading and error states

## Testing

Widget has been tested and verified:
- ✅ API endpoint returns correct data from both repos
- ✅ Widget instance created successfully
- ✅ Data is cached and served properly
- ✅ Refresh functionality works
- ✅ Error handling gracefully degrades

## Example Response

```json
{
  "prs": [
    {
      "number": 71,
      "title": "Cursor: Rename Profile tab to Insights",
      "author": "acfranzen",
      "repo": "libra",
      "url": "https://github.com/acfranzen/libra/pull/71",
      "createdAt": "10h ago",
      "state": "open"
    },
    {
      "number": 21,
      "title": "⚡ Add widget data caching layer",
      "author": "acfranzen",
      "repo": "glance",
      "url": "https://github.com/acfranzen/glance/pull/21",
      "createdAt": "12h ago",
      "state": "open"
    }
  ],
  "totalCount": 2,
  "fetchedAt": "2026-02-03T14:20:43.933Z"
}
```
