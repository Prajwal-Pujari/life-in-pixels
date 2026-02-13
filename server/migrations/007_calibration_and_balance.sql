-- ============================================================
-- Migration 007: Calibration Department & Monthly Balance Features
-- Date: 2026-01-23
-- Description: 
--   - Add site visit tracking for Calibration department
--   - Add monthly hour balance system
--   - Add compensatory off tracking
-- ============================================================

-- ============================================================
-- 1. UPDATE ATTENDANCE TABLE
-- ============================================================

-- Add site visit columns
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS is_site_visit BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS site_visit_cost DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS site_location VARCHAR(255),
ADD COLUMN IF NOT EXISTS cost_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cost_approved_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS cost_approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS compensatory_off_earned BOOLEAN DEFAULT FALSE;

-- Add indexes for site visit queries
CREATE INDEX IF NOT EXISTS idx_attendance_site_visit ON attendance(is_site_visit) WHERE is_site_visit = true;
CREATE INDEX IF NOT EXISTS idx_attendance_cost_approval ON attendance(cost_approved) WHERE is_site_visit = true AND cost_approved = false;

COMMENT ON COLUMN attendance.is_site_visit IS 'True if employee visited a site (Calibration dept)';
COMMENT ON COLUMN attendance.site_visit_cost IS 'Cost incurred during site visit (travel, food, etc.)';
COMMENT ON COLUMN attendance.site_location IS 'Location/client site visited';
COMMENT ON COLUMN attendance.cost_approved IS 'Admin approval status for reimbursement';
COMMENT ON COLUMN attendance.compensatory_off_earned IS 'True if worked on Sunday/holiday and earned comp-off';

-- ============================================================
-- 2. CREATE MONTHLY BALANCE TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS monthly_balance (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    
    -- Hours tracking
    total_hours_worked DECIMAL(10, 2) DEFAULT 0 CHECK (total_hours_worked >= 0),
    expected_hours DECIMAL(10, 2) DEFAULT 0 CHECK (expected_hours >= 0),
    balance_hours DECIMAL(10, 2) DEFAULT 0,
    
    -- Days tracking
    working_days INTEGER DEFAULT 0,
    days_present INTEGER DEFAULT 0,
    days_wfh INTEGER DEFAULT 0,
    days_half_day INTEGER DEFAULT 0,
    days_on_leave INTEGER DEFAULT 0,
    
    -- Compensatory off tracking
    comp_off_earned INTEGER DEFAULT 0 CHECK (comp_off_earned >= 0),
    comp_off_used INTEGER DEFAULT 0 CHECK (comp_off_used >= 0),
    comp_off_balance INTEGER DEFAULT 0 CHECK (comp_off_balance >= 0),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one record per user per month
    UNIQUE(user_id, year, month)
);

-- Indexes for monthly balance queries
CREATE INDEX IF NOT EXISTS idx_monthly_balance_user ON monthly_balance(user_id, year DESC, month DESC);
CREATE INDEX IF NOT EXISTS idx_monthly_balance_period ON monthly_balance(year, month);

COMMENT ON TABLE monthly_balance IS 'Monthly hour balance and compensatory off tracking per employee';
COMMENT ON COLUMN monthly_balance.balance_hours IS 'Surplus/deficit hours (total_worked - expected)';
COMMENT ON COLUMN monthly_balance.comp_off_earned IS 'Number of comp-offs earned (Sunday/holiday work)';
COMMENT ON COLUMN monthly_balance.comp_off_used IS 'Number of comp-offs used';
COMMENT ON COLUMN monthly_balance.comp_off_balance IS 'Available comp-off credits';

-- ============================================================
-- 3. CREATE COMPENSATORY OFFS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS compensatory_offs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Earned details
    earned_date DATE NOT NULL,
    earned_reason VARCHAR(255) NOT NULL, -- e.g., "Worked on Sunday", "Worked on Republic Day"
    earned_for_date DATE NOT NULL, -- The Sunday/holiday date they worked on
    
    -- Usage details
    used_date DATE,
    used_on DATE, -- The date they took off using this comp-off
    
    -- Status
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'used', 'expired', 'cancelled')),
    
    -- Expiry (optional: comp-offs expire after 3 months)
    expires_at DATE,
    
    -- Notes
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for compensatory offs
CREATE INDEX IF NOT EXISTS idx_comp_off_user_status ON compensatory_offs(user_id, status, earned_date DESC);
CREATE INDEX IF NOT EXISTS idx_comp_off_earned_date ON compensatory_offs(earned_date);
CREATE INDEX IF NOT EXISTS idx_comp_off_status ON compensatory_offs(status);

COMMENT ON TABLE compensatory_offs IS 'Individual compensatory off credits earned and used';
COMMENT ON COLUMN compensatory_offs.earned_for_date IS 'The Sunday/holiday date employee worked on';
COMMENT ON COLUMN compensatory_offs.used_on IS 'The regular working day employee took off using this credit';
COMMENT ON COLUMN compensatory_offs.expires_at IS 'Optional expiry date (3 months from earned_date)';

-- ============================================================
-- 4. FUNCTIONS AND TRIGGERS
-- ============================================================

-- Function to auto-calculate monthly balance when updated
CREATE OR REPLACE FUNCTION calculate_monthly_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate balance hours
    NEW.balance_hours := NEW.total_hours_worked - NEW.expected_hours;
    
    -- Calculate comp-off balance
    NEW.comp_off_balance := NEW.comp_off_earned - NEW.comp_off_used;
    
    -- Update timestamp
    NEW.updated_at := CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_monthly_balance
BEFORE INSERT OR UPDATE ON monthly_balance
FOR EACH ROW
EXECUTE FUNCTION calculate_monthly_balance();

COMMENT ON FUNCTION calculate_monthly_balance IS 'Auto-calculates balance hours and comp-off balance';

-- Function to update compensatory_off status when used
CREATE OR REPLACE FUNCTION mark_comp_off_used()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'used' AND OLD.status = 'available' THEN
        NEW.used_date := CURRENT_DATE;
        NEW.updated_at := CURRENT_TIMESTAMP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_mark_comp_off_used
BEFORE UPDATE ON compensatory_offs
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION mark_comp_off_used();

COMMENT ON FUNCTION mark_comp_off_used IS 'Auto-sets used_date when comp-off is marked as used';

-- ============================================================
-- 5. VIEWS FOR REPORTING
-- ============================================================

-- View: Site visits pending approval
CREATE OR REPLACE VIEW pending_site_visit_costs AS
SELECT 
    a.id,
    a.user_id,
    u.full_name,
    u.employee_id,
    u.department,
    a.date,
    a.site_location,
    a.site_visit_cost,
    a.marked_at,
    a.notes
FROM attendance a
JOIN users u ON a.user_id = u.id
WHERE a.is_site_visit = true 
  AND a.cost_approved = false
  AND a.site_visit_cost > 0
ORDER BY a.date DESC;

COMMENT ON VIEW pending_site_visit_costs IS 'Site visits with costs pending admin approval';

-- View: Monthly balance summary for all employees
CREATE OR REPLACE VIEW monthly_balance_summary AS
SELECT 
    mb.year,
    mb.month,
    u.id as user_id,
    u.full_name,
    u.employee_id,
    u.department,
    mb.total_hours_worked,
    mb.expected_hours,
    mb.balance_hours,
    mb.working_days,
    mb.days_present,
    mb.comp_off_earned,
    mb.comp_off_used,
    mb.comp_off_balance,
    CASE 
        WHEN mb.balance_hours >= 0 THEN 'surplus'
        ELSE 'deficit'
    END as balance_status,
    ROUND((mb.days_present::DECIMAL / NULLIF(mb.working_days, 0)) * 100, 2) as attendance_percentage
FROM monthly_balance mb
JOIN users u ON mb.user_id = u.id
WHERE u.is_active = true
ORDER BY mb.year DESC, mb.month DESC, u.full_name;

COMMENT ON VIEW monthly_balance_summary IS 'Monthly balance summary with attendance percentage';

-- View: Available compensatory offs per employee
CREATE OR REPLACE VIEW available_comp_offs AS
SELECT 
    c.user_id,
    u.full_name,
    u.employee_id,
    COUNT(*) as total_available,
    MIN(c.earned_date) as earliest_earned,
    MAX(c.earned_date) as latest_earned,
    MIN(c.expires_at) as next_expiry
FROM compensatory_offs c
JOIN users u ON c.user_id = u.id
WHERE c.status = 'available'
  AND (c.expires_at IS NULL OR c.expires_at > CURRENT_DATE)
GROUP BY c.user_id, u.full_name, u.employee_id
ORDER BY u.full_name;

COMMENT ON VIEW available_comp_offs IS 'Available compensatory off credits per employee';

-- ============================================================
-- 6. UPDATE ADMIN DASHBOARD VIEW
-- ============================================================

-- Drop and recreate admin_dashboard_stats view with new metrics
DROP VIEW IF EXISTS admin_dashboard_stats;

CREATE OR REPLACE VIEW admin_dashboard_stats AS
SELECT 
    (SELECT COUNT(*) FROM users WHERE is_active = true AND role = 'employee') as total_employees,
    (SELECT COUNT(*) FROM attendance WHERE date = CURRENT_DATE AND status = 'present') as present_today,
    (SELECT COUNT(*) FROM leave_requests WHERE status = 'pending') as pending_leave_requests,
    (SELECT COUNT(*) FROM holidays WHERE holiday_date > CURRENT_DATE AND holiday_date < CURRENT_DATE + INTERVAL '30 days') as upcoming_holidays,
    (SELECT COUNT(*) FROM pending_site_visit_costs) as pending_site_visit_approvals,
    (SELECT COALESCE(SUM(site_visit_cost), 0) FROM pending_site_visit_costs) as pending_reimbursement_amount,
    (SELECT COUNT(DISTINCT user_id) FROM compensatory_offs WHERE status = 'available') as employees_with_comp_offs;

COMMENT ON VIEW admin_dashboard_stats IS 'Real-time stats for admin dashboard including site visits and comp-offs';

-- ============================================================
-- 7. SEED DATA (Optional Default Values)
-- ============================================================

-- No seed data needed for this migration

-- ============================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================

/*
To rollback this migration:

DROP VIEW IF EXISTS admin_dashboard_stats;
DROP VIEW IF EXISTS available_comp_offs;
DROP VIEW IF EXISTS monthly_balance_summary;
DROP VIEW IF EXISTS pending_site_visit_costs;

DROP TRIGGER IF EXISTS trigger_mark_comp_off_used ON compensatory_offs;
DROP TRIGGER IF EXISTS trigger_calculate_monthly_balance ON monthly_balance;
DROP FUNCTION IF EXISTS mark_comp_off_used();
DROP FUNCTION IF EXISTS calculate_monthly_balance();

DROP TABLE IF EXISTS compensatory_offs;
DROP TABLE IF EXISTS monthly_balance;

ALTER TABLE attendance
DROP COLUMN IF EXISTS compensatory_off_earned,
DROP COLUMN IF EXISTS cost_approved_at,
DROP COLUMN IF EXISTS cost_approved_by,
DROP COLUMN IF EXISTS cost_approved,
DROP COLUMN IF EXISTS site_location,
DROP COLUMN IF EXISTS site_visit_cost,
DROP COLUMN IF EXISTS is_site_visit;

-- Recreate original admin_dashboard_stats view
*/

-- ============================================================
-- END OF MIGRATION
-- ============================================================
