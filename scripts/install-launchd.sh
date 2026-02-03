#!/bin/bash
#
# Glance Dashboard - launchd Service Installer
# Installs Glance as a persistent macOS service that:
# - Starts automatically on login
# - Restarts on crash
# - Logs to ~/Library/Logs/glance/
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GLANCE_DIR="${GLANCE_DIR:-$(dirname "$SCRIPT_DIR")}"
PLIST_TEMPLATE="$SCRIPT_DIR/launchd/com.glance.dashboard.plist"
PLIST_NAME="com.glance.dashboard.plist"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
LOG_DIR="$HOME/Library/Logs/glance"

echo "🚀 Glance Dashboard - launchd Service Installer"
echo "================================================"
echo ""

# Check if template exists
if [ ! -f "$PLIST_TEMPLATE" ]; then
    echo "❌ Error: plist template not found at $PLIST_TEMPLATE"
    exit 1
fi

# Check if pnpm is available and get its path
PNPM_PATH="$(command -v pnpm 2>/dev/null)"
if [ -z "$PNPM_PATH" ]; then
    echo "❌ Error: pnpm is not installed. Please install it first:"
    echo "   npm install -g pnpm"
    exit 1
fi

# Check if Glance directory exists and has package.json
if [ ! -f "$GLANCE_DIR/package.json" ]; then
    echo "❌ Error: Glance directory not found at $GLANCE_DIR"
    echo "   Set GLANCE_DIR environment variable to your Glance installation path."
    exit 1
fi

echo "📁 Glance directory: $GLANCE_DIR"
echo "📦 pnpm path: $PNPM_PATH"
echo "📝 Log directory: $LOG_DIR"
echo ""

# Create log directory
mkdir -p "$LOG_DIR"
echo "✅ Created log directory"

# Create LaunchAgents directory if it doesn't exist
mkdir -p "$LAUNCH_AGENTS_DIR"

# Unload existing service if running
if launchctl list | grep -q "com.glance.dashboard"; then
    echo "⏹️  Stopping existing service..."
    launchctl unload "$LAUNCH_AGENTS_DIR/$PLIST_NAME" 2>/dev/null || true
fi

# Generate plist with actual paths
echo "📝 Generating plist configuration..."
sed -e "s|__GLANCE_DIR__|$GLANCE_DIR|g" \
    -e "s|__HOME__|$HOME|g" \
    -e "s|__PNPM_PATH__|$PNPM_PATH|g" \
    "$PLIST_TEMPLATE" > "$LAUNCH_AGENTS_DIR/$PLIST_NAME"

echo "✅ Installed plist to $LAUNCH_AGENTS_DIR/$PLIST_NAME"

# Load the service
echo "▶️  Loading service..."
launchctl load "$LAUNCH_AGENTS_DIR/$PLIST_NAME"

echo ""
echo "✅ Glance Dashboard is now running as a service!"
echo ""
echo "📊 Dashboard: http://localhost:3333"
echo "📜 Logs:      tail -f $LOG_DIR/glance.log"
echo "❌ Errors:    tail -f $LOG_DIR/glance.error.log"
echo ""
echo "Commands:"
echo "  Stop:     launchctl unload ~/Library/LaunchAgents/$PLIST_NAME"
echo "  Start:    launchctl load ~/Library/LaunchAgents/$PLIST_NAME"
echo "  Status:   launchctl list | grep glance"
echo "  Uninstall: ./scripts/uninstall-launchd.sh"
