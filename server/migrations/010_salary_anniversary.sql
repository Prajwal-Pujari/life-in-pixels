-- ============================================================
-- Migration 010: Salary Tracking & Work Anniversary (ENCRYPTED)
-- Date: 2026-01-29
-- Description: 
--   - Add joining_date to users table
--   - Create salary_payments table with ENCRYPTED amounts
--   - Amounts are stored as encrypted TEXT, decryption happens in API
-- ============================================================

-- ============================================================
-- 1. ADD JOINING DATE TO USERS
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS joining_date DATE;

COMMENT ON COLUMN users.joining_date IS 'Employee joining date for anniversary celebrations';

-- ============================================================
-- 2. SALARY PAYMENTS TABLE (ENCRYPTED AMOUNTS)
-- ============================================================
-- NOTE: Amount is stored as encrypted TEXT (AES-256-GCM)
-- Format: iv:authTag:encryptedData (base64)
-- Only the application can decrypt using SALARY_ENCRYPTION_KEY

CREATE TABLE IF NOT EXISTS salary_payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    encrypted_amount TEXT NOT NULL, -- AES-256-GCM encrypted amount
    payment_date DATE NOT NULL,
    payment_type VARCHAR(50) NOT NULL DEFAULT 'salary' 
        CHECK (payment_type IN ('salary', 'bonus', 'reimbursement', 'advance', 'incentive', 'other')),
    payment_month VARCHAR(7), -- Format: 'YYYY-MM' for which month this payment is for
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_salary_payments_user_id ON salary_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_date ON salary_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_salary_payments_month ON salary_payments(payment_month);
CREATE INDEX IF NOT EXISTS idx_salary_payments_type ON salary_payments(payment_type);

COMMENT ON TABLE salary_payments IS 'Tracks all payments made to employees - amounts are encrypted';
COMMENT ON COLUMN salary_payments.encrypted_amount IS 'AES-256-GCM encrypted amount - only decryptable by application';
COMMENT ON COLUMN salary_payments.payment_month IS 'Which month this payment covers (YYYY-MM format)';
COMMENT ON COLUMN salary_payments.payment_type IS 'Type: salary, bonus, reimbursement, advance, incentive, other';

-- ============================================================
-- 3. UPCOMING ANNIVERSARIES VIEW
-- ============================================================

CREATE OR REPLACE VIEW upcoming_anniversaries AS
SELECT 
    id as user_id,
    full_name,
    employee_id,
    department,
    joining_date,
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, joining_date)) as years_completed,
    (joining_date + (EXTRACT(YEAR FROM AGE(CURRENT_DATE, joining_date))::int + 1) * INTERVAL '1 year')::date as next_anniversary,
    (joining_date + (EXTRACT(YEAR FROM AGE(CURRENT_DATE, joining_date))::int + 1) * INTERVAL '1 year')::date - CURRENT_DATE as days_until_anniversary
FROM users
WHERE joining_date IS NOT NULL 
  AND is_active = true
ORDER BY days_until_anniversary;

COMMENT ON VIEW upcoming_anniversaries IS 'Shows upcoming work anniversaries for active employees';

-- ============================================================
-- 4. TODAY'S ANNIVERSARIES FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION get_todays_anniversaries()
RETURNS TABLE (
    user_id INTEGER,
    full_name VARCHAR,
    employee_id VARCHAR,
    department VARCHAR,
    joining_date DATE,
    years_completed INTEGER,
    telegram_chat_id BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.full_name,
        u.employee_id,
        u.department,
        u.joining_date,
        EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.joining_date))::INTEGER,
        u.telegram_chat_id
    FROM users u
    WHERE u.joining_date IS NOT NULL 
      AND u.is_active = true
      AND EXTRACT(MONTH FROM u.joining_date) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(DAY FROM u.joining_date) = EXTRACT(DAY FROM CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_todays_anniversaries IS 'Returns employees who have work anniversary today';

-- ============================================================
-- NOTE: SALARY VIEWS REMOVED
-- ============================================================
-- employee_salary_summary and monthly_salary_breakdown views
-- are NOT created because amounts are encrypted in database.
-- All salary calculations are done in the application layer
-- after decryption for security.

-- ============================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================

/*
To rollback this migration:

DROP FUNCTION IF EXISTS get_todays_anniversaries();
DROP VIEW IF EXISTS upcoming_anniversaries;
DROP INDEX IF EXISTS idx_salary_payments_type;
DROP INDEX IF EXISTS idx_salary_payments_month;
DROP INDEX IF EXISTS idx_salary_payments_date;
DROP INDEX IF EXISTS idx_salary_payments_user_id;
DROP TABLE IF EXISTS salary_payments;
ALTER TABLE users DROP COLUMN IF EXISTS joining_date;
*/

-- ============================================================
-- END OF MIGRATION
-- ============================================================
