-- ============================================================
-- Migration 008: Calibration Site Visit Expense Tracking
-- Date: 2026-01-23
-- Description: 
--   - Add detailed site visit tracking for Calibration department
--   - Add itemized expense tracking with autocomplete support
--   - Add admin approval workflow for reimbursements
-- ============================================================

-- ============================================================
-- 1. SITE VISIT DETAILS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS site_visit_details (
    id SERIAL PRIMARY KEY,
    attendance_id INTEGER NOT NULL UNIQUE REFERENCES attendance(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    visit_date DATE NOT NULL,
    
    -- Location details
    location VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    
    -- Visit details
    num_gauges INTEGER DEFAULT 0 CHECK (num_gauges >= 0),
    visit_summary TEXT,
    conclusion TEXT,
    
    -- Approval status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
    submitted_at TIMESTAMP,
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP,
    rejection_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for site visit details
CREATE INDEX IF NOT EXISTS idx_site_visit_details_user ON site_visit_details(user_id, visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_site_visit_details_status ON site_visit_details(status);
CREATE INDEX IF NOT EXISTS idx_site_visit_details_date ON site_visit_details(visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_site_visit_details_attendance ON site_visit_details(attendance_id);

COMMENT ON TABLE site_visit_details IS 'Site visit metadata for Calibration department employees';
COMMENT ON COLUMN site_visit_details.location IS 'Physical location/address of the site visit';
COMMENT ON COLUMN site_visit_details.company_name IS 'Company/client name visited';
COMMENT ON COLUMN site_visit_details.num_gauges IS 'Number of gauges calibrated during visit';
COMMENT ON COLUMN site_visit_details.visit_summary IS 'Summary of work performed during visit';
COMMENT ON COLUMN site_visit_details.conclusion IS 'Conclusion/outcome of the site visit';
COMMENT ON COLUMN site_visit_details.status IS 'Approval workflow status: draft, submitted, approved, rejected';

-- ============================================================
-- 2. SITE VISIT EXPENSES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS site_visit_expenses (
    id SERIAL PRIMARY KEY,
    site_visit_id INTEGER NOT NULL REFERENCES site_visit_details(id) ON DELETE CASCADE,
    
    -- Expense details
    expense_type VARCHAR(100) NOT NULL, -- cab, food, materials, etc.
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    description VARCHAR(255),
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for site visit expenses
CREATE INDEX IF NOT EXISTS idx_site_visit_expenses_visit ON site_visit_expenses(site_visit_id);
CREATE INDEX IF NOT EXISTS idx_site_visit_expenses_type ON site_visit_expenses(expense_type);

COMMENT ON TABLE site_visit_expenses IS 'Itemized expenses for site visits (cab, food, materials, etc.)';
COMMENT ON COLUMN site_visit_expenses.expense_type IS 'Type of expense: cab, food, materials, lodging, etc.';
COMMENT ON COLUMN site_visit_expenses.amount IS 'Expense amount in rupees';
COMMENT ON COLUMN site_visit_expenses.description IS 'Brief description of the expense';
COMMENT ON COLUMN site_visit_expenses.notes IS 'Additional notes or details about the expense';

-- ============================================================
-- 3. FUNCTIONS AND TRIGGERS
-- ============================================================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_site_visit_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_site_visit_details_timestamp
BEFORE UPDATE ON site_visit_details
FOR EACH ROW
EXECUTE FUNCTION update_site_visit_timestamp();

CREATE TRIGGER trigger_update_site_visit_expenses_timestamp
BEFORE UPDATE ON site_visit_expenses
FOR EACH ROW
EXECUTE FUNCTION update_site_visit_timestamp();

COMMENT ON FUNCTION update_site_visit_timestamp IS 'Auto-updates updated_at timestamp on site visit records';

-- Function to update attendance table when site visit is approved
CREATE OR REPLACE FUNCTION sync_site_visit_approval()
RETURNS TRIGGER AS $$
DECLARE
    total_cost DECIMAL(10, 2);
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'submitted' THEN
        -- Calculate total expenses
        SELECT COALESCE(SUM(amount), 0) INTO total_cost
        FROM site_visit_expenses
        WHERE site_visit_id = NEW.id;
        
        -- Update attendance record
        UPDATE attendance
        SET 
            cost_approved = true,
            cost_approved_by = NEW.reviewed_by,
            cost_approved_at = NEW.reviewed_at,
            site_visit_cost = total_cost
        WHERE id = NEW.attendance_id;
        
    ELSIF NEW.status = 'rejected' AND OLD.status = 'submitted' THEN
        -- Update attendance record
        UPDATE attendance
        SET 
            cost_approved = false,
            cost_approved_by = NEW.reviewed_by,
            cost_approved_at = NEW.reviewed_at
        WHERE id = NEW.attendance_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_site_visit_approval
AFTER UPDATE ON site_visit_details
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION sync_site_visit_approval();

COMMENT ON FUNCTION sync_site_visit_approval IS 'Syncs approval status to attendance table when site visit is approved/rejected';

-- ============================================================
-- 4. VIEWS FOR REPORTING AND AUTOCOMPLETE
-- ============================================================

-- View: Pending expense approvals (for admin dashboard)
CREATE OR REPLACE VIEW pending_calibration_approvals AS
SELECT 
    svd.id,
    svd.user_id,
    u.full_name,
    u.employee_id,
    svd.visit_date,
    svd.location,
    svd.company_name,
    svd.num_gauges,
    svd.visit_summary,
    svd.conclusion,
    svd.submitted_at,
    COALESCE(SUM(sve.amount), 0) as total_expenses,
    COUNT(sve.id) as expense_count
FROM site_visit_details svd
JOIN users u ON svd.user_id = u.id
LEFT JOIN site_visit_expenses sve ON svd.id = sve.site_visit_id
WHERE svd.status = 'submitted'
GROUP BY svd.id, svd.user_id, u.full_name, u.employee_id, svd.visit_date, 
         svd.location, svd.company_name, svd.num_gauges, svd.visit_summary, 
         svd.conclusion, svd.submitted_at
ORDER BY svd.submitted_at ASC;

COMMENT ON VIEW pending_calibration_approvals IS 'Pending site visit expense approvals with total costs';

-- View: Autocomplete data for locations, companies, and expense types
CREATE OR REPLACE VIEW expense_autocomplete_data AS
SELECT 
    'location' as type,
    location as value,
    COUNT(*) as usage_count
FROM site_visit_details
WHERE location IS NOT NULL AND location != ''
GROUP BY location

UNION ALL

SELECT 
    'company' as type,
    company_name as value,
    COUNT(*) as usage_count
FROM site_visit_details
WHERE company_name IS NOT NULL AND company_name != ''
GROUP BY company_name

UNION ALL

SELECT 
    'expense_type' as type,
    expense_type as value,
    COUNT(*) as usage_count
FROM site_visit_expenses
WHERE expense_type IS NOT NULL AND expense_type != ''
GROUP BY expense_type

ORDER BY type, usage_count DESC;

COMMENT ON VIEW expense_autocomplete_data IS 'Autocomplete suggestions for locations, companies, and expense types';

-- View: Site visit history with total expenses
CREATE OR REPLACE VIEW site_visit_history AS
SELECT 
    svd.id,
    svd.user_id,
    u.full_name,
    u.employee_id,
    svd.visit_date,
    svd.location,
    svd.company_name,
    svd.num_gauges,
    svd.visit_summary,
    svd.conclusion,
    svd.status,
    svd.submitted_at,
    svd.reviewed_at,
    reviewer.full_name as reviewed_by_name,
    svd.rejection_reason,
    COALESCE(SUM(sve.amount), 0) as total_expenses,
    COUNT(sve.id) as expense_count,
    array_agg(
        json_build_object(
            'type', sve.expense_type,
            'amount', sve.amount,
            'description', sve.description,
            'notes', sve.notes
        )
    ) FILTER (WHERE sve.id IS NOT NULL) as expenses
FROM site_visit_details svd
JOIN users u ON svd.user_id = u.id
LEFT JOIN users reviewer ON svd.reviewed_by = reviewer.id
LEFT JOIN site_visit_expenses sve ON svd.id = sve.site_visit_id
GROUP BY svd.id, svd.user_id, u.full_name, u.employee_id, svd.visit_date,
         svd.location, svd.company_name, svd.num_gauges, svd.visit_summary,
         svd.conclusion, svd.status, svd.submitted_at, svd.reviewed_at,
         reviewer.full_name, svd.rejection_reason
ORDER BY svd.visit_date DESC;

COMMENT ON VIEW site_visit_history IS 'Complete site visit history with expenses and approval details';

-- ============================================================
-- 5. UPDATE ADMIN DASHBOARD VIEW
-- ============================================================

-- Drop and recreate admin_dashboard_stats view with calibration metrics
DROP VIEW IF EXISTS admin_dashboard_stats;

CREATE OR REPLACE VIEW admin_dashboard_stats AS
SELECT 
    (SELECT COUNT(*) FROM users WHERE is_active = true AND role = 'employee') as total_employees,
    (SELECT COUNT(*) FROM attendance WHERE date = CURRENT_DATE AND status = 'present') as present_today,
    (SELECT COUNT(*) FROM leave_requests WHERE status = 'pending') as pending_leave_requests,
    (SELECT COUNT(*) FROM holidays WHERE holiday_date > CURRENT_DATE AND holiday_date < CURRENT_DATE + INTERVAL '30 days') as upcoming_holidays,
    (SELECT COUNT(*) FROM pending_site_visit_costs) as pending_site_visit_approvals,
    (SELECT COALESCE(SUM(site_visit_cost), 0) FROM pending_site_visit_costs) as pending_reimbursement_amount,
    (SELECT COUNT(DISTINCT user_id) FROM compensatory_offs WHERE status = 'available') as employees_with_comp_offs,
    (SELECT COUNT(*) FROM pending_calibration_approvals) as pending_calibration_expenses,
    (SELECT COALESCE(SUM(total_expenses), 0) FROM pending_calibration_approvals) as pending_calibration_amount;

COMMENT ON VIEW admin_dashboard_stats IS 'Real-time stats for admin dashboard including calibration expenses';

-- ============================================================
-- 6. SEED DATA (Optional Default Expense Types)
-- ============================================================

-- No seed data needed for this migration

-- ============================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================

/*
To rollback this migration:

DROP VIEW IF EXISTS admin_dashboard_stats;
DROP VIEW IF EXISTS site_visit_history;
DROP VIEW IF EXISTS expense_autocomplete_data;
DROP VIEW IF EXISTS pending_calibration_approvals;

DROP TRIGGER IF EXISTS trigger_sync_site_visit_approval ON site_visit_details;
DROP TRIGGER IF EXISTS trigger_update_site_visit_expenses_timestamp ON site_visit_expenses;
DROP TRIGGER IF EXISTS trigger_update_site_visit_details_timestamp ON site_visit_details;

DROP FUNCTION IF EXISTS sync_site_visit_approval();
DROP FUNCTION IF EXISTS update_site_visit_timestamp();

DROP TABLE IF EXISTS site_visit_expenses;
DROP TABLE IF EXISTS site_visit_details;

-- Recreate original admin_dashboard_stats view
*/

-- ============================================================
-- END OF MIGRATION
-- ============================================================
