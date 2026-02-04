#!/bin/bash
#
# Glance Dashboard - systemd Service Installer
# Installs Glance as a persistent Linux service that:
# - Starts automatically on login
# - Restarts on crash
# - Logs to ~/.local/state/glance/
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GLANCE_DIR="${GLANCE_DIR:-$(dirname "$SCRIPT_DIR")}"
SERVICE_TEMPLATE="$SCRIPT_DIR/systemd/glance.service"
SERVICE_NAME="glance.service"
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
LOG_DIR="$HOME/.local/state/glance"

echo "🚀 Glance Dashboard - systemd Service Installer"
echo "==============================================="
echo ""

# Check if template exists
if [ ! -f "$SERVICE_TEMPLATE" ]; then
    echo "❌ Error: systemd template not found at $SERVICE_TEMPLATE"
    exit 1
fi

# Check if npm is available and get its path
NPM_PATH="$(command -v npm 2>/dev/null)"
if [ -z "$NPM_PATH" ]; then
    echo "❌ Error: npm is not installed. Please install it first:"
    echo "   Please ensure Node.js is properly installed"
    exit 1
fi

# Check if Glance directory exists and has package.json
if [ ! -f "$GLANCE_DIR/package.json" ]; then
    echo "❌ Error: Glance directory not found at $GLANCE_DIR"
    echo "   Set GLANCE_DIR environment variable to your Glance installation path."
    exit 1
fi

echo "📁 Glance directory: $GLANCE_DIR"
echo "📦 npm path: $NPM_PATH"
echo "📝 Log directory: $LOG_DIR"
echo ""

# Create log directory
mkdir -p "$LOG_DIR"
echo "✅ Created log directory"

# Create systemd user directory if it doesn't exist
mkdir -p "$SYSTEMD_USER_DIR"

# Stop existing service if running
if systemctl --user is-active --quiet glance 2>/dev/null; then
    echo "⏹️  Stopping existing service..."
    systemctl --user stop glance || true
fi

# Generate service file with actual paths
echo "📝 Generating systemd service configuration..."
sed -e "s|__GLANCE_DIR__|$GLANCE_DIR|g" \
    -e "s|__HOME__|$HOME|g" \
    -e "s|__NPM_PATH__|$NPM_PATH|g" \
    "$SERVICE_TEMPLATE" > "$SYSTEMD_USER_DIR/$SERVICE_NAME"

echo "✅ Installed service to $SYSTEMD_USER_DIR/$SERVICE_NAME"

# Reload systemd daemon
echo "🔄 Reloading systemd daemon..."
systemctl --user daemon-reload

# Enable and start the service
echo "▶️  Enabling and starting service..."
systemctl --user enable glance
systemctl --user start glance

echo ""
echo "✅ Glance Dashboard is now running as a service!"
echo ""
echo "📊 Dashboard: http://localhost:3333"
echo "📜 Logs:      journalctl --user -u glance -f"
echo "           or tail -f $LOG_DIR/glance.log"
echo "❌ Errors:    tail -f $LOG_DIR/glance.error.log"
echo ""
echo "Commands:"
echo "  Stop:       systemctl --user stop glance"
echo "  Start:      systemctl --user start glance"
echo "  Status:     systemctl --user status glance"
echo "  Restart:    systemctl --user restart glance"
echo "  Disable:    systemctl --user disable glance"
echo "  Uninstall:  ./scripts/uninstall-systemd.sh"
