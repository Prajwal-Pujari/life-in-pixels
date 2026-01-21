-- User Approval System Migration
-- Adds approval workflow with auto-generated employee IDs

-- 1. Add is_approved column
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;

-- 2. Make role nullable (pending users don't have a role yet)
ALTER TABLE users ALTER COLUMN role DROP NOT NULL;
ALTER TABLE users ALTER COLUMN role DROP DEFAULT;

-- 3. Function to auto-generate Employee IDs (EMP001, EMP002, etc.)
CREATE OR REPLACE FUNCTION generate_employee_id()
RETURNS VARCHAR AS $$
DECLARE
    max_id INTEGER;
    new_id VARCHAR;
BEGIN
    -- Get the highest number from existing employee IDs
    SELECT COALESCE(MAX(CAST(SUBSTRING(employee_id FROM 4) AS INTEGER)), 0) + 1
    INTO max_id
    FROM users
    WHERE employee_id LIKE 'EMP%' AND employee_id ~ '^EMP[0-9]+$';
    
    -- Generate new ID with zero-padding (EMP001, EMP002, etc.)
    new_id := 'EMP' || LPAD(max_id::TEXT, 3, '0');
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger to auto-generate Employee ID on user creation
CREATE OR REPLACE FUNCTION set_employee_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.employee_id IS NULL OR NEW.employee_id = '' THEN
        NEW.employee_id := generate_employee_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_set_employee_id ON users;
CREATE TRIGGER trigger_set_employee_id
    BEFORE INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_employee_id();

-- 5. Update existing users to be approved (backward compatibility)
UPDATE users SET is_approved = TRUE WHERE is_approved IS NULL OR is_approved = FALSE;

-- 6. Ensure first admin is always approved
UPDATE users SET is_approved = TRUE WHERE role = 'admin';

COMMENT ON COLUMN users.is_approved IS 'Whether admin has approved this user (for Google OAuth users)';
COMMENT ON FUNCTION generate_employee_id() IS 'Auto-generates sequential employee IDs (EMP001, EMP002, ...)';
COMMENT ON FUNCTION set_employee_id() IS 'Trigger function to auto-assign employee ID on user creation';
