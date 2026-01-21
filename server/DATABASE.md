# Database Schema & Setup Guide

## 📋 Overview

This file contains the complete PostgreSQL database schema for the Life in Pixels Team Work Tracker system.

## 🗄️ Tables

### Core Tables
- **users** - User accounts with Google OAuth
- **attendance** - Daily attendance with work logs
- **leave_requests** - Leave/holiday requests
- **user_settings** - Per-user configuration
- **notifications** - User notifications
- **work_logs** - Detailed work journals (optional)
- **holidays** - Company holidays
- **activity_log** - Immutable audit trail

### Views
- **admin_dashboard_stats** - Real-time dashboard KPIs
- **today_attendance_summary** - Today's attendance counts
- **employee_attendance_rates** - Attendance statistics

## 🚀 Setup Instructions

### Fresh Installation

```bash
# 1. Create database
createdb pixel_calendar

# 2. Run schema
psql pixel_calendar < server/schema.sql

# 3. Verify
psql pixel_calendar -c "\dt"
```

### Migration from Old Schema

```bash
# 1. Backup existing database
pg_dump pixel_calendar > backup_$(date +%Y%m%d).sql

# 2. Run migration
psql pixel_calendar < server/schema.sql

# 3. Migrate existing journal entries (if any)
psql pixel_calendar -c "
INSERT INTO work_logs 
SELECT user_id, entry_date, one_sentence as task_summary, mood as work_status, 
       morning, work, moments, thoughts, gratitude, end_of_day, 
       study_start_time, study_end_time, study_subject, study_notes, 
       created_at, updated_at
FROM journal_entries
ON CONFLICT (user_id, entry_date) DO NOTHING;
"
```

## 🔑 Key Features

### 1. Auto-created Settings
When a user is created, `user_settings` is automatically created via trigger with:
- 12 annual leave days (default)
- Notifications enabled
- Morning reminder: 9:30 AM
- Evening reminder: 6:00 PM

### 2. Leave Balance Auto-update
When admin approves/rejects leave:
- **Approved**: `leaves_pending` → `leaves_taken`
- **Rejected**: `leaves_pending` decremented

### 3. One Record Per Day
Both `attendance` and `work_logs` enforce `UNIQUE(user_id, date)` to prevent duplicates.

### 4. Immutable Audit Log
`activity_log` has NO updated_at field - entries cannot be modified.

## 📊 Sample Queries

### Check today's attendance
```sql
SELECT * FROM today_attendance_summary;
```

### Get admin dashboard stats
```sql
SELECT * FROM admin_dashboard_stats;
```

### View employee attendance rates
```sql
SELECT * FROM employee_attendance_rates;
```

### Get pending leave requests
```sql
SELECT lr.*, u.full_name 
FROM leave_requests lr
JOIN users u ON lr.user_id = u.id
WHERE lr.status = 'pending'
ORDER BY lr.created_at;
```

## 🛠️ Maintenance

### Cleanup old notifications
```sql
DELETE FROM notifications 
WHERE created_at < NOW() - INTERVAL '90 days' 
AND is_read = true;
```

### Archive old activity logs
```sql
-- Create archive table first
CREATE TABLE activity_log_archive AS TABLE activity_log;

-- Move old records
INSERT INTO activity_log_archive 
SELECT * FROM activity_log 
WHERE created_at < NOW() - INTERVAL '1 year';

DELETE FROM activity_log 
WHERE created_at < NOW() - INTERVAL '1 year';
```

## ⚠️ Important Notes

1. **First user becomes admin** - Update the seed data SQL with your email
2. **Google OAuth required** - All users must link Google account
3. **Backup before migration** - Always backup production data
4. **Check constraints** - Leave balance calculations are enforced at DB level

## 🔒 Security

- All foreign keys have `ON DELETE CASCADE` where appropriate
- Triggers maintain data integrity
- Activity log tracks all significant actions
- IP and user agent logged for security audit

## 📞 Troubleshooting

**Error: relation "users" already exists**
- You have old schema. Run migration instead of fresh install.

**Error: constraint violation on leave balance**
- Cannot request more leave than quota allows
- Check `user_settings.annual_leave_quota` and pending leaves

**Missing admin user**
- Run the seed data section of schema.sql manually
- Update email to match your Google account
