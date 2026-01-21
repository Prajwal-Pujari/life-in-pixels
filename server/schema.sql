-- ============================================================
-- Life in Pixels - Team Work Tracker
-- Complete Database Schema
-- Version: 2.0
-- Date: 2026-01-19
-- ============================================================

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS leave_requests CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS work_logs CASCADE;
DROP TABLE IF EXISTS journal_entries CASCADE;
DROP TABLE IF EXISTS activity_log CASCADE;
DROP TABLE IF EXISTS holidays CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  
  -- Google OAuth fields
  google_id VARCHAR(255) UNIQUE,
  google_email VARCHAR(255),
  avatar_url TEXT,
  
  -- Basic info
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  
  -- Role & permissions
  role VARCHAR(20) DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  
  -- Employee details
  employee_id VARCHAR(50) UNIQUE,
  department VARCHAR(100),
  
  -- Invite system
  invited_by INTEGER REFERENCES users(id),
  invite_token VARCHAR(255) UNIQUE,
  invite_accepted_at TIMESTAMP,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for users
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_invite_token ON users(invite_token);

COMMENT ON TABLE users IS 'User accounts with Google OAuth integration';
COMMENT ON COLUMN users.google_id IS 'Unique Google user ID from OAuth';
COMMENT ON COLUMN users.invite_token IS 'Token for employee invite system';

-- ============================================================
-- ATTENDANCE TABLE (NEW - Core Feature)
-- ============================================================
CREATE TABLE attendance (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Date and status
  date DATE NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'leave', 'holiday', 'weekend')),
  
  -- When marked
  marked_at TIMESTAMP,
  
  -- Work details
  work_hours_start TIME,
  work_hours_end TIME,
  
  -- Tasks completed (array of strings)
  tasks_completed TEXT[],
  
  -- Project/category
  project_category VARCHAR(100),
  
  -- Optional notes
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure one record per user per day
  UNIQUE(user_id, date)
);

-- Indexes for attendance
CREATE INDEX idx_attendance_user_date ON attendance(user_id, date DESC);
CREATE INDEX idx_attendance_date ON attendance(date DESC);
CREATE INDEX idx_attendance_status ON attendance(status);
CREATE INDEX idx_attendance_date_status ON attendance(date, status);

COMMENT ON TABLE attendance IS 'Daily attendance tracking with work logs';
COMMENT ON COLUMN attendance.tasks_completed IS 'Array of task descriptions completed that day';
COMMENT ON COLUMN attendance.marked_at IS 'When employee marked attendance (NULL if auto-marked absent)';

-- ============================================================
-- LEAVE REQUESTS TABLE (NEW)
-- ============================================================
CREATE TABLE leave_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Leave dates
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- Leave details
  leave_type VARCHAR(50) DEFAULT 'casual' CHECK (leave_type IN ('casual', 'sick', 'vacation', 'personal')),
  reason TEXT,
  
  -- Approval workflow
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure end_date >= start_date
  CHECK (end_date >= start_date)
);

-- Indexes for leave_requests
CREATE INDEX idx_leave_requests_user ON leave_requests(user_id, created_at DESC);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_leave_requests_dates ON leave_requests(start_date, end_date);

COMMENT ON TABLE leave_requests IS 'Employee leave/holiday requests with approval workflow';

-- ============================================================
-- USER SETTINGS TABLE (NEW)
-- ============================================================
CREATE TABLE user_settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  
  -- Leave quota
  annual_leave_quota INTEGER DEFAULT 12,
  leaves_taken INTEGER DEFAULT 0,
  leaves_pending INTEGER DEFAULT 0,
  
  -- Notification preferences
  notification_enabled BOOLEAN DEFAULT true,
  notification_morning_time TIME DEFAULT '09:30:00',
  notification_evening_time TIME DEFAULT '18:00:00',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure positive values
  CHECK (annual_leave_quota >= 0),
  CHECK (leaves_taken >= 0),
  CHECK (leaves_pending >= 0),
  CHECK (leaves_taken + leaves_pending <= annual_leave_quota)
);

COMMENT ON TABLE user_settings IS 'Per-user settings for leave quota and notifications';
COMMENT ON COLUMN user_settings.annual_leave_quota IS 'Total annual leave days allocated';
COMMENT ON COLUMN user_settings.leaves_taken IS 'Approved leave days consumed';
COMMENT ON COLUMN user_settings.leaves_pending IS 'Pending leave request days';

-- ============================================================
-- NOTIFICATIONS TABLE (NEW)
-- ============================================================
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Notification details
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  link VARCHAR(255),
  
  -- Read status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for notifications
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_type ON notifications(type);

COMMENT ON TABLE notifications IS 'User notifications for attendance reminders, leave approvals, etc.';
COMMENT ON COLUMN notifications.type IS 'attendance_reminder, leave_approved, leave_rejected, etc.';

-- ============================================================
-- WORK LOGS TABLE (Renamed from journal_entries)
-- ============================================================
CREATE TABLE work_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Date
  entry_date DATE NOT NULL,
  
  -- Summary
  task_summary TEXT,
  work_status VARCHAR(20) CHECK (work_status IN ('productive', 'normal', 'challenging', 'blocked')),
  
  -- Detailed sections
  morning TEXT,
  work TEXT,
  moments TEXT,
  thoughts TEXT,
  gratitude TEXT,
  end_of_day TEXT,
  
  -- Study tracking (keep for backward compatibility)
  study_start_time TIME,
  study_end_time TIME,
  study_subject VARCHAR(255),
  study_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- One entry per user per day
  UNIQUE(user_id, entry_date)
);

-- Indexes for work_logs
CREATE INDEX idx_work_logs_user_date ON work_logs(user_id, entry_date DESC);

COMMENT ON TABLE work_logs IS 'Optional detailed work logs (renamed from journal_entries)';
COMMENT ON COLUMN work_logs.task_summary IS 'One-sentence summary of the day (renamed from one_sentence)';
COMMENT ON COLUMN work_logs.work_status IS 'How productive the day was (renamed from mood)';

-- ============================================================
-- HOLIDAYS TABLE (Keep existing)
-- ============================================================
CREATE TABLE holidays (
  id SERIAL PRIMARY KEY,
  
  -- Holiday details
  holiday_name VARCHAR(100) NOT NULL,
  holiday_date DATE NOT NULL,
  description TEXT,
  is_recurring BOOLEAN DEFAULT false,
  
  -- Who added it
  created_by INTEGER REFERENCES users(id),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for holidays
CREATE INDEX idx_holidays_date ON holidays(holiday_date);

COMMENT ON TABLE holidays IS 'Company-wide holidays';
COMMENT ON COLUMN holidays.is_recurring IS 'If true, repeats yearly';

-- ============================================================
-- ACTIVITY LOG TABLE (Keep existing - immutable audit trail)
-- ============================================================
CREATE TABLE activity_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  
  -- Action details
  action_type VARCHAR(50) NOT NULL,
  action_details TEXT,
  
  -- IP tracking (new)
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamp (immutable - no updated_at)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for activity_log
CREATE INDEX idx_activity_log_user ON activity_log(user_id, created_at DESC);
CREATE INDEX idx_activity_log_type ON activity_log(action_type);
CREATE INDEX idx_activity_log_created ON activity_log(created_at DESC);

COMMENT ON TABLE activity_log IS 'Immutable audit trail of all user actions';
COMMENT ON COLUMN activity_log.action_type IS 'login, mark_attendance, request_leave, approve_leave, etc.';

-- ============================================================
-- VIEWS FOR ADMIN DASHBOARD
-- ============================================================

-- Today's attendance summary
CREATE OR REPLACE VIEW today_attendance_summary AS
SELECT 
  COUNT(*) FILTER (WHERE status = 'present') as present_count,
  COUNT(*) FILTER (WHERE status = 'absent') as absent_count,
  COUNT(*) FILTER (WHERE status = 'leave') as leave_count,
  COUNT(*) FILTER (WHERE marked_at IS NULL AND status = 'present') as not_marked_count,
  COUNT(*) as total_employees
FROM attendance
WHERE date = CURRENT_DATE;

-- Admin dashboard stats (replaces missing table)
CREATE OR REPLACE VIEW admin_dashboard_stats AS
SELECT 
  (SELECT COUNT(*) FROM users WHERE is_active = true AND role = 'employee') as total_employees,
  (SELECT COALESCE(present_count, 0) FROM today_attendance_summary) as present_today,
  (SELECT COUNT(*) FROM leave_requests WHERE status = 'pending') as pending_leave_requests,
  (SELECT COUNT(*) FROM holidays WHERE holiday_date > CURRENT_DATE AND holiday_date < CURRENT_DATE + INTERVAL '30 days') as upcoming_holidays;

COMMENT ON VIEW admin_dashboard_stats IS 'Real-time stats for admin dashboard';

-- Employee attendance rate view
CREATE OR REPLACE VIEW employee_attendance_rates AS
SELECT 
  u.id as user_id,
  u.full_name,
  u.employee_id,
  COUNT(*) as total_days,
  COUNT(*) FILTER (WHERE a.status = 'present') as days_present,
  COUNT(*) FILTER (WHERE a.status = 'absent') as days_absent,
  COUNT(*) FILTER (WHERE a.status = 'leave') as days_leave,
  ROUND(100.0 * COUNT(*) FILTER (WHERE a.status = 'present') / NULLIF(COUNT(*), 0), 2) as attendance_rate
FROM users u
LEFT JOIN attendance a ON u.id = a.user_id
WHERE u.role = 'employee' AND u.is_active = true
GROUP BY u.id, u.full_name, u.employee_id;

COMMENT ON VIEW employee_attendance_rates IS 'Attendance statistics per employee';

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Function to auto-create user_settings when user is created
CREATE OR REPLACE FUNCTION create_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_settings (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_user_settings
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION create_user_settings();

COMMENT ON FUNCTION create_user_settings IS 'Auto-creates user_settings row when user is created';

-- Function to update leave balance when leave is approved
CREATE OR REPLACE FUNCTION update_leave_balance()
RETURNS TRIGGER AS $$
DECLARE
  days_count INTEGER;
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    -- Calculate days
    days_count := (NEW.end_date - NEW.start_date) + 1;
    
    -- Update user_settings
    UPDATE user_settings
    SET 
      leaves_taken = leaves_taken + days_count,
      leaves_pending = leaves_pending - days_count
    WHERE user_id = NEW.user_id;
    
  ELSIF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
    -- Return pending days
    days_count := (NEW.end_date - NEW.start_date) + 1;
    
    UPDATE user_settings
    SET leaves_pending = leaves_pending - days_count
    WHERE user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_leave_balance
AFTER UPDATE ON leave_requests
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION update_leave_balance();

COMMENT ON FUNCTION update_leave_balance IS 'Updates leave quota when leave request is approved/rejected';

-- Function to increment pending leaves when request is created
CREATE OR REPLACE FUNCTION increment_pending_leaves()
RETURNS TRIGGER AS $$
DECLARE
  days_count INTEGER;
BEGIN
  days_count := (NEW.end_date - NEW.start_date) + 1;
  
  UPDATE user_settings
  SET leaves_pending = leaves_pending + days_count
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_pending_leaves
AFTER INSERT ON leave_requests
FOR EACH ROW
WHEN (NEW.status = 'pending')
EXECUTE FUNCTION increment_pending_leaves();

-- ============================================================
-- SEED DATA
-- ============================================================

-- Create first admin user (you'll need to update this after Google OAuth is set up)
INSERT INTO users (
  username, 
  email, 
  full_name, 
  role, 
  employee_id, 
  department, 
  is_active
) VALUES (
  'admin',
  'admin@company.com',
  'Admin User',
  'admin',
  'EMP001',
  'Management',
  true
) ON CONFLICT DO NOTHING;

-- Create sample holidays for 2026
INSERT INTO holidays (holiday_name, holiday_date, description, is_recurring, created_by) VALUES
('New Year', '2026-01-01', 'New Year''s Day', true, 1),
('Republic Day', '2026-01-26', 'Republic Day of India', true, 1),
('Holi', '2026-03-14', 'Festival of Colors', false, 1),
('Independence Day', '2026-08-15', 'Independence Day of India', true, 1),
('Gandhi Jayanti', '2026-10-02', 'Birthday of Mahatma Gandhi', true, 1),
('Diwali', '2026-11-01', 'Festival of Lights', false, 1),
('Christmas', '2026-12-25', 'Christmas Day', true, 1)
ON CONFLICT DO NOTHING;

-- ============================================================
-- GRANT PERMISSIONS (Optional - adjust as needed)
-- ============================================================

-- Grant all permissions to the application user
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

-- ============================================================
-- MIGRATION NOTES
-- ============================================================

/*
MIGRATION FROM OLD SCHEMA:

1. If you have existing journal_entries data:
   INSERT INTO work_logs (user_id, entry_date, task_summary, work_status, morning, work, moments, thoughts, gratitude, end_of_day, study_start_time, study_end_time, study_subject, study_notes, created_at, updated_at)
   SELECT user_id, entry_date, one_sentence, mood, morning, work, moments, thoughts, gratitude, end_of_day, study_start_time, study_end_time, study_subject, study_notes, created_at, updated_at
   FROM journal_entries;

2. All users need to link their Google accounts on next login
   - Set google_id and google_email during OAuth flow

3. Initial leave quota (12 days) will be set automatically via trigger

4. Activity log is preserved as-is

ROLLBACK PLAN:
- Keep backups of old database
- Can revert by restoring from backup
- Or rename work_logs back to journal_entries
*/

-- ============================================================
-- END OF SCHEMA
-- ============================================================
