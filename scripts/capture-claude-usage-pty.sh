#!/bin/bash
# PTY wrapper script for capturing Claude CLI usage output
# This script uses the 'script' command to create a PTY and capture the claude output
# Usage: ./capture-claude-usage-pty.sh

CLAUDE_PATH="${CLAUDE_PATH:-/opt/homebrew/bin/claude}"
CACHE_FILE="/tmp/claude-usage-cache.json"
TMP_OUTPUT="/tmp/claude-pty-output-$$.txt"

# Run claude with script command to provide a PTY
# The -q flag suppresses script's own output
# We give it a 10-second timeout
timeout 10s script -q "$TMP_OUTPUT" "$CLAUDE_PATH" --dangerously-skip-permissions </dev/null >/dev/null 2>&1 || true

# Check if we got output
if [ ! -f "$TMP_OUTPUT" ] || [ ! -s "$TMP_OUTPUT" ]; then
  echo "Error: No output captured from claude CLI" >&2
  rm -f "$TMP_OUTPUT"
  exit 1
fi

# Read the output
OUTPUT=$(cat "$TMP_OUTPUT")
rm -f "$TMP_OUTPUT"

# Parse the output and create JSON
# This is a simple parser - adjust regex as needed based on actual output format
SESSION_PERCENT=$(echo "$OUTPUT" | grep -i "Current session" | grep -o "[0-9]\+%" | tr -d '%')
SESSION_RESETS=$(echo "$OUTPUT" | grep -i "Current session" | sed -n 's/.*Resets at \(.*\)/\1/p' | xargs)

WEEK_ALL_PERCENT=$(echo "$OUTPUT" | grep -i "Week (all models)" | grep -o "[0-9]\+%" | tr -d '%')
WEEK_ALL_RESETS=$(echo "$OUTPUT" | grep -i "Week (all models)" | sed -n 's/.*Resets \(.*\)/\1/p' | xargs)

WEEK_OPUS_PERCENT=$(echo "$OUTPUT" | grep -i "Week (Opus)" | grep -o "[0-9]\+%" | tr -d '%')
WEEK_OPUS_RESETS=$(echo "$OUTPUT" | grep -i "Week (Opus)" | sed -n 's/.*Resets \(.*\)/\1/p' | xargs)

# Parse Extra usage if present
EXTRA_PERCENT=$(echo "$OUTPUT" | grep -A2 "Extra usage" | grep -o "[0-9]\+%" | tr -d '%' | head -1)
EXTRA_SPENT=$(echo "$OUTPUT" | grep "spent" | grep -o '\$[0-9.]\+' | head -1)
EXTRA_LIMIT=$(echo "$OUTPUT" | grep "spent" | grep -o '\$[0-9.]\+' | tail -1)
EXTRA_RESETS=$(echo "$OUTPUT" | grep -i "Extra usage" -A2 | grep "Resets" | sed -n 's/.*Resets \([^·]*\).*/\1/p' | xargs)

# Build JSON
cat > "$CACHE_FILE" <<EOF
{
  "session": {
    "percentUsed": ${SESSION_PERCENT:-0},
    "resetsAt": "${SESSION_RESETS:-Unknown}"
  },
  "weekAll": {
    "percentUsed": ${WEEK_ALL_PERCENT:-0},
    "resetsAt": "${WEEK_ALL_RESETS:-Unknown}"
  },
  "weekOpus": {
    "percentUsed": ${WEEK_OPUS_PERCENT:-0},
    "resetsAt": "${WEEK_OPUS_RESETS:-Unknown}"
  },
EOF

if [ -n "$EXTRA_PERCENT" ]; then
  cat >> "$CACHE_FILE" <<EOF
  "extra": {
    "percentUsed": ${EXTRA_PERCENT},
    "spent": ${EXTRA_SPENT#\$},
    "limit": ${EXTRA_LIMIT#\$},
    "resetsAt": "${EXTRA_RESETS}"
  },
EOF
fi

cat >> "$CACHE_FILE" <<EOF
  "capturedAt": "$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")"
}
EOF

echo "Usage data captured and cached to $CACHE_FILE"
cat "$CACHE_FILE"
