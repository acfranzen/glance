#!/bin/bash
#
# Glance Dashboard - systemd Service Uninstaller
# Removes the Glance service from systemd
#

set -e

SERVICE_NAME="glance.service"
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
LOG_DIR="$HOME/.local/state/glance"

echo "🗑️  Glance Dashboard - systemd Service Uninstaller"
echo "=================================================="
echo ""

# Stop and disable service if running
if systemctl --user is-active --quiet glance 2>/dev/null; then
    echo "⏹️  Stopping service..."
    systemctl --user stop glance || true
    echo "✅ Service stopped"
fi

if systemctl --user is-enabled --quiet glance 2>/dev/null; then
    echo "🚫 Disabling service..."
    systemctl --user disable glance || true
    echo "✅ Service disabled"
fi

# Remove service file
if [ -f "$SYSTEMD_USER_DIR/$SERVICE_NAME" ]; then
    rm "$SYSTEMD_USER_DIR/$SERVICE_NAME"
    echo "✅ Removed service file from $SYSTEMD_USER_DIR"
    
    # Reload systemd daemon
    systemctl --user daemon-reload
else
    echo "ℹ️  Service file not found (already removed?)"
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
echo "To reinstall, run: ./scripts/install-systemd.sh"
