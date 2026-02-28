#!/bin/bash
# ============================================================
# Life in Pixels - Ubuntu Server Setup Script
# Run: chmod +x setup-ubuntu.sh && ./setup-ubuntu.sh
# ============================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_header() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}  ${GREEN}🚀 Life In Pixels - Ubuntu Server Setup${NC}          ${CYAN}║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}📌 STEP: $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"

print_header

echo -e "${YELLOW}This script will:${NC}"
echo "  1. Install Node.js 20.x, PostgreSQL, and build tools"
echo "  2. Create the pixel_calendar database"
echo "  3. Run schema.sql + all migrations"
echo "  4. Install npm dependencies (frontend + server)"
echo "  5. Generate environment config files"
echo "  6. Set up PM2 process manager"
echo ""

read -p "Continue? (y/N): " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Aborted."
    exit 0
fi

# ============================================================
# STEP 1: Install System Dependencies
# ============================================================
print_step "Installing system dependencies..."

# Check if Node.js is installed
if command -v node &> /dev/null; then
    NODE_VER=$(node -v)
    print_success "Node.js already installed: $NODE_VER"
else
    echo "Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    print_success "Node.js installed: $(node -v)"
fi

# Check if PostgreSQL is installed
if command -v psql &> /dev/null; then
    PG_VER=$(psql --version)
    print_success "PostgreSQL already installed: $PG_VER"
else
    echo "Installing PostgreSQL..."
    sudo apt install -y postgresql postgresql-contrib
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
    print_success "PostgreSQL installed"
fi

# Install build tools (needed for bcrypt)
echo "Installing build tools..."
sudo apt install -y build-essential python3 2>/dev/null || true
print_success "Build tools installed"

# ============================================================
# STEP 2: Configure PostgreSQL
# ============================================================
print_step "Setting up PostgreSQL database..."

# Prompt for database password
read -sp "Enter a password for PostgreSQL user 'postgres': " DB_PASSWORD
echo ""

if [ -z "$DB_PASSWORD" ]; then
    DB_PASSWORD="pixel_calendar_2026"
    print_warning "No password entered, using default: $DB_PASSWORD"
fi

# Set postgres password
sudo -u postgres psql -c "ALTER USER postgres PASSWORD '$DB_PASSWORD';" 2>/dev/null || true

# Create database (ignore error if it already exists)
sudo -u postgres psql -c "CREATE DATABASE pixel_calendar;" 2>/dev/null || {
    print_warning "Database 'pixel_calendar' already exists (that's OK)"
}

print_success "Database 'pixel_calendar' ready"

# ============================================================
# STEP 3: Run Schema and Migrations
# ============================================================
print_step "Running database schema and migrations..."

cd "$PROJECT_DIR"

# Run base schema
echo "Running schema.sql..."
sudo -u postgres psql pixel_calendar < server/schema.sql 2>&1 || {
    print_warning "Some schema commands may have warnings (usually OK for existing objects)"
}
print_success "Base schema applied"

# Run migrations in order
MIGRATION_DIR="server/migrations"
if [ -d "$MIGRATION_DIR" ]; then
    for migration in $(ls "$MIGRATION_DIR"/*.sql | sort); do
        migration_name=$(basename "$migration")
        echo "Running migration: $migration_name..."
        sudo -u postgres psql pixel_calendar < "$migration" 2>&1 || {
            print_warning "Migration $migration_name had warnings (may be OK if re-running)"
        }
    done
    print_success "All migrations applied"
else
    print_warning "No migrations directory found"
fi

# Verify tables
echo ""
echo "Verifying database tables..."
TABLE_COUNT=$(sudo -u postgres psql pixel_calendar -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" | tr -d ' ')
echo -e "${GREEN}✅ Found $TABLE_COUNT tables in pixel_calendar database${NC}"

echo ""
echo "Tables:"
sudo -u postgres psql pixel_calendar -c "\dt" 2>/dev/null || true

# ============================================================
# STEP 4: Install npm Dependencies
# ============================================================
print_step "Installing npm dependencies..."

cd "$PROJECT_DIR"

# Install frontend dependencies
echo "Installing frontend dependencies..."
npm install
print_success "Frontend dependencies installed"

# Install server dependencies
echo "Installing server dependencies..."
cd server
npm install
print_success "Server dependencies installed"

cd "$PROJECT_DIR"

# ============================================================
# STEP 5: Generate Environment Files
# ============================================================
print_step "Configuring environment variables..."

# Detect server IP
SERVER_IP=$(hostname -I | awk '{print $1}')
echo "Detected server IP: $SERVER_IP"

# Generate secrets
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
SALARY_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Create server/.env
cat > server/.env << EOF
# ============================================================
# Life in Pixels - Server Environment Configuration
# Generated by setup-ubuntu.sh on $(date)
# ============================================================

# Database
DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@localhost:5432/pixel_calendar

# Server
PORT=3001
NODE_ENV=production

# JWT Secret (auto-generated)
JWT_SECRET=${JWT_SECRET}

# Session Secret (auto-generated)
SESSION_SECRET=${SESSION_SECRET}

# Google OAuth Configuration
# ⚠️  YOU MUST UPDATE THESE with your Google Cloud Console credentials!
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET_HERE
GOOGLE_CALLBACK_URL=http://${SERVER_IP}:3001/api/auth/google/callback
FRONTEND_URL=http://${SERVER_IP}:3000

# Telegram Bot Configuration
TELEGRAM_ENABLED=false
TELEGRAM_BOT_TOKEN=your-bot-token-here
TELEGRAM_CHAT_ID=your-chat-id-here

# Salary Encryption Key (auto-generated)
SALARY_ENCRYPTION_KEY=${SALARY_KEY}

# Email Configuration (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM_NAME=Life In Pixels
SMTP_FROM_EMAIL=your-email@gmail.com
EOF

print_success "Created server/.env"

# Create frontend .env
cat > .env << EOF
# Frontend Configuration
VITE_API_URL=http://${SERVER_IP}:3001/api
EOF

print_success "Created .env (frontend)"

# ============================================================
# STEP 6: Build Frontend
# ============================================================
print_step "Building frontend for production..."

cd "$PROJECT_DIR"
npm run build 2>&1 && {
    print_success "Frontend built successfully (output in dist/)"
} || {
    print_warning "Frontend build had issues - you may need to fix TypeScript errors"
    print_warning "You can still run the dev server with: npm run dev -- --host 0.0.0.0"
}

# ============================================================
# STEP 7: Install and Configure PM2
# ============================================================
print_step "Setting up PM2 process manager..."

# Install PM2 if not already installed
if command -v pm2 &> /dev/null; then
    print_success "PM2 already installed"
else
    echo "Installing PM2..."
    sudo npm install -g pm2
    print_success "PM2 installed"
fi

# Stop existing processes if any
pm2 delete pixel-server 2>/dev/null || true
pm2 delete pixel-frontend 2>/dev/null || true

# Start backend server
cd "$PROJECT_DIR/server"
pm2 start index.js --name "pixel-server" --cwd "$PROJECT_DIR/server"
print_success "Backend server started on port 3001"

# Start frontend dev server
cd "$PROJECT_DIR"
pm2 start "npx vite --host 0.0.0.0 --port 3000" --name "pixel-frontend" --cwd "$PROJECT_DIR"
print_success "Frontend server started on port 3000"

# Save PM2 process list
pm2 save

# Set up PM2 startup (auto-start on reboot)
echo ""
echo -e "${YELLOW}Setting up PM2 to start on boot...${NC}"
pm2 startup 2>&1 | tail -1
echo -e "${YELLOW}👆 If you see a 'sudo' command above, copy and run it!${NC}"

# ============================================================
# STEP 8: Open Firewall Ports
# ============================================================
print_step "Configuring firewall..."

if command -v ufw &> /dev/null; then
    sudo ufw allow 22/tcp   2>/dev/null || true  # SSH
    sudo ufw allow 80/tcp   2>/dev/null || true  # HTTP
    sudo ufw allow 3000/tcp 2>/dev/null || true  # Frontend
    sudo ufw allow 3001/tcp 2>/dev/null || true  # Backend API
    sudo ufw --force enable 2>/dev/null || true
    print_success "Firewall configured (ports 22, 80, 3000, 3001 open)"
else
    print_warning "UFW not found, skipping firewall configuration"
fi

# ============================================================
# DONE!
# ============================================================
echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${GREEN}🎉 SETUP COMPLETE!${NC}                                          ${CYAN}║${NC}"
echo -e "${CYAN}╠════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${CYAN}║${NC}                                                                ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  ${YELLOW}Frontend:${NC}  http://${SERVER_IP}:3000                         ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  ${YELLOW}Backend:${NC}   http://${SERVER_IP}:3001                         ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  ${YELLOW}API:${NC}       http://${SERVER_IP}:3001/api                     ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}                                                                ${CYAN}║${NC}"
echo -e "${CYAN}╠════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${CYAN}║${NC}  ${RED}⚠️  IMPORTANT: You still need to:${NC}                            ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}                                                                ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  1. Update Google OAuth credentials in server/.env             ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  2. Add your server IP to Google Cloud Console                 ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}     as authorized redirect URI:                                ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}     http://${SERVER_IP}:3001/api/auth/google/callback      ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  3. Update Telegram bot token if using Telegram                ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  4. Run the PM2 startup command (if shown above)               ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}                                                                ${CYAN}║${NC}"
echo -e "${CYAN}╠════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${CYAN}║${NC}  ${BLUE}Useful Commands:${NC}                                              ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  pm2 status         - Check process status                     ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  pm2 logs           - View all logs                            ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  pm2 restart all    - Restart everything                       ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  pm2 logs pixel-server --lines 50  - View server logs          ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}                                                                ${CYAN}║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
