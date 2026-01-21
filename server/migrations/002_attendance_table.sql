-- Attendance table for tracking employee attendance
CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'half_day', 'wfh', 'on_leave')),
    check_in_time TIME,
    check_out_time TIME,
    total_hours DECIMAL(4,2),
    notes TEXT,
    marked_by_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, attendance_date)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);

-- Trigger to update total_hours automatically
CREATE OR REPLACE FUNCTION calculate_total_hours()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.check_in_time IS NOT NULL AND NEW.check_out_time IS NOT NULL THEN
        NEW.total_hours := EXTRACT(EPOCH FROM (NEW.check_out_time - NEW.check_in_time)) / 3600;
    END IF;
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_hours
    BEFORE INSERT OR UPDATE ON attendance
    FOR EACH ROW
    EXECUTE FUNCTION calculate_total_hours();

-- Add attendance summary to admin dashboard view (if it doesn't exist)
-- This will be useful for admin reports
CREATE OR REPLACE VIEW attendance_summary AS
SELECT 
    u.id as user_id,
    u.full_name,
    u.employee_id,
    DATE_TRUNC('month', a.attendance_date) as month,
    COUNT(*) FILTER (WHERE a.status = 'present') as days_present,
    COUNT(*) FILTER (WHERE a.status = 'absent') as days_absent,
    COUNT(*) FILTER (WHERE a.status = 'half_day') as days_half,
    COUNT(*) FILTER (WHERE a.status = 'wfh') as days_wfh,
    COUNT(*) FILTER (WHERE a.status = 'on_leave') as days_leave,
    SUM(a.total_hours) as total_hours_worked
FROM users u
LEFT JOIN attendance a ON u.id = a.user_id
WHERE u.role = 'employee' AND u.is_active = true
GROUP BY u.id, u.full_name, u.employee_id, DATE_TRUNC('month', a.attendance_date);
