# Claude Max Usage Widget API

This API endpoint provides Claude Max usage data for the dashboard widget.

## Endpoint

`GET /api/widgets/claude-max/data`

### Query Parameters

- `demo=true` - Return demo/mock data instead of real usage
- `refresh=true` - Force a fresh capture, bypassing cache

### Response Format

```json
{
  "session": {
    "percentUsed": 81,
    "resetsAt": "6pm EST"
  },
  "weekAll": {
    "percentUsed": 100,
    "resetsAt": "1pm EST"
  },
  "weekOpus": {
    "percentUsed": 2,
    "resetsAt": "Feb 6, 11am"
  },
  "extra": {
    "percentUsed": 5,
    "spent": 5.54,
    "limit": 100.00,
    "resetsAt": "Mar 1 (America/New_York)"
  },
  "capturedAt": "2026-02-02T20:18:00.000Z",
  "lastUpdated": "2026-02-02T20:30:00.000Z",
  "fromCache": true
}
```

## Setup

### Option 1: Manual PTY Capture (Recommended)

Since the Claude CLI requires a PTY to display usage information, you can manually capture it using the provided shell script:

```bash
# Run manually or via cron
./scripts/capture-claude-usage-pty.sh
```

Set up a cron job to refresh the cache periodically:

```bash
# Add to crontab (refresh every 10 minutes)
*/10 * * * * cd /path/to/glance && ./scripts/capture-claude-usage-pty.sh >/dev/null 2>&1
```

### Option 2: Automatic Capture (Current Implementation)

The API route attempts to capture usage automatically using `child_process.exec`. However, the Claude CLI may hang or fail if it expects a PTY. If automatic capture fails, the API falls back to cached data.

Set the `CLAUDE_PATH` environment variable if your claude binary is not at the default location:

```bash
# In .env.local
CLAUDE_PATH=/opt/homebrew/bin/claude
```

## Caching

- Cache file: `/tmp/claude-usage-cache.json`
- Cache TTL: 5 minutes
- Stale cache is returned if fresh capture fails

## Frontend Integration

The `ClaudeMaxUsageWidget` component automatically:

- Fetches data on mount
- Refreshes every 5 minutes
- Allows manual refresh via button (sends `?refresh=true`)
- Displays relative timestamps ("5m ago", "2h ago", etc.)
- Shows all usage metrics with progress bars
- Highlights Extra usage section when available

## Troubleshooting

**"Failed to refresh" error:**
- The claude CLI might be hanging or not responding
- Try running the manual PTY capture script instead
- Check that `claude --dangerously-skip-permissions` works in your terminal

**Old/stale data:**
- Check that the cache file exists and is recent: `ls -la /tmp/claude-usage-cache.json`
- Try manual refresh from the widget UI
- Run the PTY capture script manually

**node-pty compatibility issues:**
- Current implementation avoids node-pty due to compatibility issues with Node 25.5.0
- If you need PTY support, consider downgrading to Node 22 LTS and rebuilding node-pty
