#!/bin/bash
#
# Glance Dashboard - launchd Service Uninstaller
# Removes the Glance service from macOS launchd
#

set -e

PLIST_NAME="com.glance.dashboard.plist"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
LOG_DIR="$HOME/Library/Logs/glance"

echo "🗑️  Glance Dashboard - launchd Service Uninstaller"
echo "==================================================="
echo ""

# Unload service if running
if launchctl list | grep -q "com.glance.dashboard"; then
    echo "⏹️  Stopping service..."
    launchctl unload "$LAUNCH_AGENTS_DIR/$PLIST_NAME" 2>/dev/null || true
    echo "✅ Service stopped"
else
    echo "ℹ️  Service was not running"
fi

# Remove plist
if [ -f "$LAUNCH_AGENTS_DIR/$PLIST_NAME" ]; then
    rm "$LAUNCH_AGENTS_DIR/$PLIST_NAME"
    echo "✅ Removed plist from $LAUNCH_AGENTS_DIR"
else
    echo "ℹ️  Plist not found (already removed?)"
fi

echo ""
read -p "Remove log files at $LOG_DIR? [y/N] " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf "$LOG_DIR"
    echo "✅ Removed log directory"
else
    echo "ℹ️  Log files preserved at $LOG_DIR"
fi

echo ""
echo "✅ Glance Dashboard service has been uninstalled."
echo ""
echo "To reinstall, run: ./scripts/install-launchd.sh"
