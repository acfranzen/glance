#!/bin/bash
#
# Glance Dashboard - Universal Installer
# One-line install: curl -fsSL https://raw.githubusercontent.com/acfranzen/glance/main/scripts/install.sh | bash
#

set -e

# Configuration
GLANCE_DIR="${GLANCE_DIR:-$HOME/.glance}"
REPO_URL="${REPO_URL:-https://github.com/acfranzen/glance.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    else
        echo "unknown"
    fi
}

OS=$(detect_os)

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   🚀 Glance Dashboard Installer          ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo -e "${BLUE}📦 Installation directory:${NC} $GLANCE_DIR"
echo -e "${BLUE}💻 Operating system:${NC} $OS"
echo ""

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Error: git is not installed${NC}"
    echo "Please install git first:"
    if [ "$OS" = "macos" ]; then
        echo "  xcode-select --install"
    else
        echo "  sudo apt install git  # Debian/Ubuntu"
        echo "  sudo yum install git  # RHEL/CentOS"
    fi
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Error: Node.js is not installed${NC}"
    echo "Please install Node.js first:"
    echo "  https://nodejs.org/ (v18 or later recommended)"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${YELLOW}⚠️  Warning: Node.js v$NODE_VERSION detected. v18+ recommended.${NC}"
fi

# Check/enable pnpm via corepack
echo -e "${BLUE}📦 Setting up pnpm...${NC}"
if ! command -v pnpm &> /dev/null; then
    echo "   Enabling pnpm via corepack..."
    if command -v corepack &> /dev/null; then
        corepack enable pnpm
    else
        echo -e "${RED}❌ Error: corepack not available${NC}"
        echo "Please install pnpm manually:"
        echo "  npm install -g pnpm"
        exit 1
    fi
fi

PNPM_VERSION=$(pnpm --version)
echo -e "${GREEN}✅ pnpm v$PNPM_VERSION${NC}"

# Clone or update repository
if [ -d "$GLANCE_DIR" ]; then
    echo -e "${YELLOW}📁 Directory exists, updating...${NC}"
    cd "$GLANCE_DIR"
    
    # Check if it's a git repo
    if [ -d .git ]; then
        git fetch origin
        git reset --hard "origin/$REPO_BRANCH"
        echo -e "${GREEN}✅ Updated to latest version${NC}"
    else
        echo -e "${RED}❌ Error: $GLANCE_DIR exists but is not a git repository${NC}"
        exit 1
    fi
else
    echo -e "${BLUE}📥 Cloning repository...${NC}"
    git clone --branch "$REPO_BRANCH" "$REPO_URL" "$GLANCE_DIR"
    cd "$GLANCE_DIR"
    echo -e "${GREEN}✅ Repository cloned${NC}"
fi

# Install dependencies
echo ""
echo -e "${BLUE}📦 Installing dependencies...${NC}"
pnpm install

echo ""
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Ask about service installation
echo ""
echo -e "${BLUE}🔧 Service Installation${NC}"
echo ""

if [ "$OS" = "macos" ]; then
    echo "Would you like to install Glance as a launchd service?"
    echo "This will:"
    echo "  • Start Glance automatically on login"
    echo "  • Restart it if it crashes"
    echo "  • Keep it running in the background"
    echo ""
    read -p "Install as service? [Y/n] " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
        export GLANCE_DIR
        ./scripts/install-launchd.sh
        SERVICE_INSTALLED=true
    fi
elif [ "$OS" = "linux" ]; then
    echo "Would you like to install Glance as a systemd service?"
    echo "This will:"
    echo "  • Start Glance automatically on login"
    echo "  • Restart it if it crashes"
    echo "  • Keep it running in the background"
    echo ""
    read -p "Install as service? [Y/n] " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
        export GLANCE_DIR
        ./scripts/install-systemd.sh
        SERVICE_INSTALLED=true
    fi
else
    echo -e "${YELLOW}⚠️  Service installation not available on $OS${NC}"
fi

# Start manually if service not installed
if [ -z "$SERVICE_INSTALLED" ]; then
    echo ""
    echo -e "${BLUE}▶️  Starting Glance Dashboard...${NC}"
    echo ""
    
    # Start in background
    pnpm dev > /dev/null 2>&1 &
    DEV_PID=$!
    
    echo -e "${GREEN}✅ Glance is starting (PID: $DEV_PID)${NC}"
    echo ""
    echo "Waiting for server to be ready..."
    
    # Wait for server to respond (max 30 seconds)
    for i in {1..30}; do
        if curl -s http://localhost:3333 > /dev/null 2>&1; then
            break
        fi
        sleep 1
    done
fi

# Open browser
echo ""
if command -v open &> /dev/null; then
    # macOS
    open http://localhost:3333
    echo -e "${GREEN}✅ Opening dashboard in browser...${NC}"
elif command -v xdg-open &> /dev/null; then
    # Linux
    xdg-open http://localhost:3333 2>/dev/null
    echo -e "${GREEN}✅ Opening dashboard in browser...${NC}"
else
    echo -e "${YELLOW}⚠️  Could not open browser automatically${NC}"
fi

# Final instructions
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   ✅ Installation Complete!              ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo -e "${BLUE}📊 Dashboard:${NC} http://localhost:3333"
echo ""

if [ "$SERVICE_INSTALLED" ]; then
    echo -e "${GREEN}Service is running in the background.${NC}"
    if [ "$OS" = "macos" ]; then
        echo "  Stop:   launchctl unload ~/Library/LaunchAgents/com.glance.dashboard.plist"
        echo "  Logs:   tail -f ~/Library/Logs/glance/glance.log"
    else
        echo "  Stop:   systemctl --user stop glance"
        echo "  Logs:   journalctl --user -u glance -f"
    fi
else
    echo -e "${YELLOW}Manual mode:${NC} Close your terminal to stop the dashboard."
    echo "To run as a background service, run:"
    if [ "$OS" = "macos" ]; then
        echo "  cd $GLANCE_DIR && ./scripts/install-launchd.sh"
    else
        echo "  cd $GLANCE_DIR && ./scripts/install-systemd.sh"
    fi
fi

echo ""
echo "📖 Documentation: https://github.com/acfranzen/glance"
echo ""
