# 🚀 Phase 1 Setup Guide - Google OAuth Configuration

## ✅ What's Complete

- [x] Database schema created (`schema.sql`)
- [x] Security fixes applied (`.gitignore` updated)
- [x] Required

 npm packages installed
- [x] Environment template created (`.env.example`)

## 🔑 Next Step: Configure Google OAuth

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Create Project" or select existing project
3. Name it: `Life in Pixels Work Tracker`

### 2. Enable Google+ API

1. In Cloud Console, go to **APIs & Services** → **Library**
2. Search for "Google+ API"
3. Click **Enable**

### 3. Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth Client ID**
3. Configure OAuth consent screen (if first time):
   - User Type: **Internal** (if you have Google Workspace) or **External**
   - App name: `Life in Pixels Work Tracker`
   - User support email: Your email
   - Add scopes: `email`, `profile`, `openid`
   - Add test users (if External): Add your team emails

4. Create OAuth Client ID:
   - Application type: **Web application**
   - Name: `Life in Pixels Backend`
   - Authorized redirect URIs:
     - `http://localhost:3001/api/auth/google/callback`
     - `http://localhost:3000/auth/callback` (frontend)
   
5. Copy the **Client ID** and **Client Secret**

### 4. Update Server .env File

```bash
cd server
cp .env.example .env
```

Edit `server/.env` and update:

```env
# Database (update YOUR_PASSWORD)
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/pixel_calendar

# Generate a strong JWT secret:
# Run: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=paste_generated_secret_here

# Google OAuth (paste your credentials)
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# Frontend
FRONTEND_URL=http://localhost:3000
```

### 5. Set Up Database

```bash
# Option A: Fresh installation
createdb pixel_calendar
psql pixel_calendar < server/schema.sql

# Option B: If database exists (migrate)
psql pixel_calendar < server/schema.sql
```

Verify:
```bash
psql pixel_calendar -c "\dt"
# Should show: users, attendance, leave_requests, etc.
```

### 6. Update Admin User

Edit the admin user in database to match YOUR Google email:

```sql
UPDATE users 
SET email = 'your-real-email@gmail.com',
    google_email = 'your-real-email@gmail.com'
WHERE username = 'admin';
```

OR delete the seed admin and sign up as first user (becomes admin automatically).

## 🧪 Test Google OAuth

Once backend is updated (next step), test with:

```bash
cd server
npm run dev
```

Visit: `http://localhost:3001/api/auth/google`  
Should redirect to Google sign-in.

## 📝 Frontend Setup (Later)

Will need to add to frontend `.env`:

```env
VITE_API_URL=http://localhost:3001/api
VITE_GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
```

## ⚠️ Troubleshooting

**"redirect_uri_mismatch" error**
- Make sure `http://localhost:3001/api/auth/google/callback` is in Google Console → Authorized redirect URIs

**"invalid_client" error**
- Double-check Client ID and Secret in `.env`
- No extra spaces or quotes

**Database connection error**
- Check `DATABASE_URL` has correct password
- PostgreSQL is running: `pg_isready`

## 🎯 Next Actions

1. ✅ Complete OAuth setup above
2. ⏳ I'll implement Google OAuth backend routes
3. ⏳ I'll update existing auth to use Google
4. ⏳ I'll remove password authentication

**Estimated time to complete OAuth setup**: 15-20 minutes
