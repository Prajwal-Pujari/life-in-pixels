# 🚀 Life in Pixels - Ubuntu Server Deployment Guide

Complete guide to deploy the **Pixel Calendar** app on an Ubuntu server.

---

## 📋 Architecture

| Component   | Technology       | Port |
|-------------|------------------|------|
| Frontend    | React + Vite     | 3000 |
| Backend     | Node.js + Express| 3001 |
| Database    | PostgreSQL       | 5432 |
| Bot         | Telegram API     | -    |

---

## 🔧 Step 1: Install Prerequisites

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node -v   # Should be v20.x
npm -v    # Should be 10.x

# Install PostgreSQL 16
sudo apt install -y postgresql postgresql-contrib

# Verify
sudo systemctl status postgresql
psql --version

# Install Git
sudo apt install -y git

# Install build tools (needed for bcrypt native module)
sudo apt install -y build-essential python3
```

---

## 🗄️ Step 2: Set Up PostgreSQL Database

```bash
# Switch to postgres user
sudo -u postgres psql

# Inside psql, run these commands:
```

```sql
-- 1. Create the database
CREATE DATABASE pixel_calendar;

-- 2. Set a password for postgres user (CHANGE THIS!)
ALTER USER postgres PASSWORD 'your_secure_password_here';

-- 3. Verify
\l

-- 4. Exit
\q
```

### Apply the Schema + All Migrations

```bash
# Navigate to your project folder
cd /path/to/pixel-calendar

# Run the base schema
sudo -u postgres psql pixel_calendar < server/schema.sql

# Run ALL migrations in order (THIS IS CRITICAL!)
sudo -u postgres psql pixel_calendar < server/migrations/002_attendance_table.sql
sudo -u postgres psql pixel_calendar < server/migrations/003_user_approval_system.sql
sudo -u postgres psql pixel_calendar < server/migrations/004_fix_attendance_status.sql
sudo -u postgres psql pixel_calendar < server/migrations/005_fix_employee_id_generation.sql
sudo -u postgres psql pixel_calendar < server/migrations/006_add_telegram_id.sql
sudo -u postgres psql pixel_calendar < server/migrations/007_calibration_and_balance.sql
sudo -u postgres psql pixel_calendar < server/migrations/008_calibration_expenses.sql
sudo -u postgres psql pixel_calendar < server/migrations/009_telegram_verification.sql
sudo -u postgres psql pixel_calendar < server/migrations/010_salary_anniversary.sql
sudo -u postgres psql pixel_calendar < server/migrations/011_task_management.sql

# Verify all tables were created
sudo -u postgres psql pixel_calendar -c "\dt"
```

You should see tables like: `users`, `attendance`, `leave_requests`, `user_settings`, `notifications`, `work_logs`, `holidays`, `activity_log`, `monthly_balance`, `compensatory_offs`, `site_visit_details`, `site_visit_expenses`, `tasks`, `task_attachments`, `task_comments`, `email_queue`, `email_templates`, `telegram_verification_codes`, `salary_payments`.

---

## 📁 Step 3: Clone & Install Dependencies

```bash
# Clone your repo (or copy files)
git clone <your-repo-url> /home/$USER/pixel-calendar
cd /home/$USER/pixel-calendar

# Install frontend dependencies
npm install

# Install server dependencies
cd server
npm install
cd ..
```

---

## ⚙️ Step 4: Configure Environment Variables

### Server `.env` (`server/.env`)

```bash
cd /home/$USER/pixel-calendar/server
cp .env.example .env
nano .env
```

Update these values:

```env
# Database - USE YOUR ACTUAL PASSWORD
DATABASE_URL=postgresql://postgres:your_secure_password_here@localhost:5432/pixel_calendar

# Server
PORT=3001
NODE_ENV=production

# JWT Secret - Generate a new one!
# Run: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=PASTE_GENERATED_KEY_HERE

# Session Secret - Generate another one!
SESSION_SECRET=PASTE_ANOTHER_GENERATED_KEY_HERE

# Google OAuth - Use YOUR credentials from Google Cloud Console
# IMPORTANT: Update the callback URL to your server's IP/domain!
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://YOUR_SERVER_IP:3001/api/auth/google/callback
FRONTEND_URL=http://YOUR_SERVER_IP:3000

# Telegram Bot (set to false if not using)
TELEGRAM_ENABLED=false
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id

# Salary Encryption Key - Generate one!
# Run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SALARY_ENCRYPTION_KEY=PASTE_64_CHAR_HEX_KEY_HERE

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM_NAME=Life In Pixels
SMTP_FROM_EMAIL=your-email@gmail.com
```

### Frontend `.env` (root `.env`)

```bash
cd /home/$USER/pixel-calendar
nano .env
```

```env
VITE_API_URL=http://YOUR_SERVER_IP:3001/api
```

---

## 🏗️ Step 5: Build the Frontend

```bash
cd /home/$USER/pixel-calendar

# Build the React frontend for production
npm run build
```

This creates a `dist/` folder with the production build.

---

## 🚀 Step 6: Run with PM2 (Process Manager)

PM2 keeps your app running after you log out and auto-restarts on crashes.

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the backend server
cd /home/$USER/pixel-calendar/server
pm2 start index.js --name "pixel-server"

# Start the frontend dev server (or use Nginx for production - see below)
cd /home/$USER/pixel-calendar
pm2 start "npm run dev -- --host 0.0.0.0" --name "pixel-frontend"

# Save PM2 process list & set to start on boot
pm2 save
pm2 startup
# Copy and run the command PM2 gives you!
```

### PM2 Useful Commands

```bash
pm2 status          # Check status of all processes
pm2 logs            # View all logs
pm2 logs pixel-server    # View server logs only
pm2 restart all     # Restart everything
pm2 stop all        # Stop everything
```

---

## 🌐 Step 7 (Recommended): Nginx Reverse Proxy

For production, serve the frontend with Nginx and proxy API requests:

```bash
sudo apt install -y nginx
```

Create a config file:

```bash
sudo nano /etc/nginx/sites-available/pixel-calendar
```

Paste this:

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    # Frontend - serve built files
    location / {
        root /home/YOUR_USER/pixel-calendar/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/pixel-calendar /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Remove default site
sudo nginx -t                              # Test config
sudo systemctl restart nginx
```

If using Nginx, update your `.env`:
- `FRONTEND_URL=http://YOUR_DOMAIN_OR_IP` (port 80, no port needed)
- `VITE_API_URL=http://YOUR_DOMAIN_OR_IP/api`

---

## 🔥 Step 8: Open Firewall Ports

```bash
sudo ufw allow 22     # SSH
sudo ufw allow 80     # HTTP (Nginx)
sudo ufw allow 3000   # Frontend (if NOT using Nginx)
sudo ufw allow 3001   # Backend API
sudo ufw enable
```

---

## ✅ Verification Checklist

```bash
# 1. Check PostgreSQL is running
sudo systemctl status postgresql

# 2. Test database connection
sudo -u postgres psql pixel_calendar -c "SELECT COUNT(*) FROM users;"

# 3. Check all tables exist
sudo -u postgres psql pixel_calendar -c "\dt"

# 4. Check Node.js server is running
pm2 status

# 5. Test the API
curl http://localhost:3001/api/auth/me

# 6. Check logs for errors
pm2 logs pixel-server --lines 50
```

---

## 🐛 Common Issues & Fixes

### Database connection error
```
❌ Database connection error: password authentication failed
```
**Fix:** Make sure `DATABASE_URL` in `server/.env` matches your PostgreSQL password:
```bash
# Reset postgres password
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'new_password';"
```

### Missing columns / relation errors
```
ERROR: column "is_approved" does not exist
ERROR: column "telegram_id" does not exist
```
**Fix:** You didn't run all migrations! Run them in order:
```bash
cd /home/$USER/pixel-calendar
for f in server/migrations/*.sql; do sudo -u postgres psql pixel_calendar < "$f"; done
```

### bcrypt build error
```
Error: Cannot find module 'bcrypt'
```
**Fix:**
```bash
cd server
npm rebuild bcrypt
# or
sudo apt install -y build-essential python3
npm install bcrypt
```

### Port already in use
```bash
# Find what's using the port
sudo lsof -i :3001
# Kill it
sudo kill -9 <PID>
```

### Google OAuth not working
- Make sure your Google Cloud Console has `http://YOUR_SERVER_IP:3001/api/auth/google/callback` as an authorized redirect URI
- Make sure `GOOGLE_CALLBACK_URL` in `server/.env` matches exactly

---

## 📜 Quick 1-Command Setup Script

For convenience, save the script below as `setup.sh` and run it:

```bash
chmod +x setup.sh
./setup.sh
```

See the `setup-ubuntu.sh` file in this repo for the full automated script.
