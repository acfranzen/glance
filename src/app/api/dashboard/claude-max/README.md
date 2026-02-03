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

---

## Widget Package Configuration

This widget demonstrates the `agent_refresh` fetch type and `local_software` credential type. Here's how it would be configured for sharing as a widget package:

### Credentials

```json
{
  "credentials": [
    {
      "id": "claude-cli",
      "type": "local_software",
      "name": "Claude CLI",
      "description": "Anthropic's Claude CLI tool for checking usage",
      "check_command": "which claude",
      "install_url": "https://docs.anthropic.com/en/docs/claude-code/getting-started",
      "install_instructions": "Install Claude Code from Anthropic's documentation. Requires an active Claude Max subscription."
    }
  ]
}
```

### Setup (Agent Skill)

The `setup.agent_skill` field contains instructions that OpenClaw can follow to configure the widget:

```markdown
# Claude Max Usage Widget Setup

This widget requires a local PTY capture script to read Claude CLI usage data.

## Prerequisites
- Claude CLI installed and authenticated (`claude --version` should work)
- Active Claude Max subscription
- Glance running locally

## Setup Steps

1. **Create the capture script** at `./scripts/capture-claude-usage-pty.sh`:

\`\`\`bash
#!/usr/bin/env bash
set -euo pipefail

CLAUDE_PATH="${CLAUDE_PATH:-claude}"
CACHE_FILE="/tmp/claude-usage-cache.json"

# Capture usage via PTY
usage_output=$(script -q /dev/null "$CLAUDE_PATH" --dangerously-skip-permissions 2>&1 << 'EOF'
/usage
/exit
EOF
)

# Parse and save to cache
node ./scripts/extract-claude-usage.js "$usage_output" > "$CACHE_FILE"
\`\`\`

2. **Make the script executable**:
\`\`\`bash
chmod +x ./scripts/capture-claude-usage-pty.sh
\`\`\`

3. **Test the script**:
\`\`\`bash
./scripts/capture-claude-usage-pty.sh
cat /tmp/claude-usage-cache.json
\`\`\`

4. **Set up cron job** for automatic refresh:
\`\`\`bash
(crontab -l 2>/dev/null; echo "*/10 * * * * cd $(pwd) && ./scripts/capture-claude-usage-pty.sh >/dev/null 2>&1") | crontab -
\`\`\`

## Verification
The setup is complete when `/tmp/claude-usage-cache.json` exists and contains valid JSON.
```

### Fetch Configuration

```json
{
  "fetch": {
    "type": "agent_refresh",
    "schedule": "*/10 * * * *",
    "instructions": "Run the PTY capture script and POST results to /api/custom-widgets/claude-max-usage/cache",
    "expected_freshness_seconds": 600,
    "max_staleness_seconds": 1800
  }
}
```

### Full Package Structure

When exported, this widget's package would include:

```json
{
  "version": 1,
  "type": "glance-widget",
  "meta": {
    "name": "Claude Max Usage",
    "slug": "claude-max-usage",
    "description": "Track your Claude Max API usage across session, weekly, and extra limits",
    "author": "Glance Team"
  },
  "widget": {
    "source_code": "function Widget({ serverData }) { ... }",
    "default_size": { "w": 4, "h": 3 },
    "min_size": { "w": 3, "h": 2 },
    "refresh_interval": 300
  },
  "credentials": [
    {
      "id": "claude-cli",
      "type": "local_software",
      "name": "Claude CLI",
      "description": "Anthropic's Claude CLI tool",
      "check_command": "which claude"
    }
  ],
  "setup": {
    "description": "Set up PTY capture script for Claude usage data",
    "agent_skill": "# Claude Max Usage Widget Setup\n\n...",
    "verification": {
      "type": "file_exists",
      "target": "/tmp/claude-usage-cache.json"
    },
    "idempotent": true,
    "estimated_time": "5 minutes"
  },
  "fetch": {
    "type": "agent_refresh",
    "schedule": "*/10 * * * *",
    "instructions": "Run PTY capture script and POST to cache endpoint",
    "expected_freshness_seconds": 600,
    "max_staleness_seconds": 1800
  },
  "cache": {
    "ttl_seconds": 600,
    "max_staleness_seconds": 1800,
    "on_error": "use_stale"
  }
}
```

This configuration allows OpenClaw to:
1. Check if Claude CLI is installed
2. Follow the agent_skill instructions to set up the capture script
3. On the cron schedule, run the capture script and POST data to the cache endpoint
4. Widget reads cached data via the execute endpoint
