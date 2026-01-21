-- Fix employee ID generation to prevent duplicates

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trigger_set_employee_id ON users;
DROP FUNCTION IF EXISTS set_employee_id();
DROP FUNCTION IF EXISTS generate_employee_id();

-- Create improved employee ID generation function
CREATE OR REPLACE FUNCTION generate_employee_id()
RETURNS VARCHAR AS $$
DECLARE
    max_id INTEGER;
    new_id VARCHAR;
    attempts INTEGER := 0;
BEGIN
    LOOP
        -- Get the highest number from existing employee IDs
        SELECT COALESCE(MAX(
            CASE 
                WHEN employee_id ~ '^EMP[0-9]+$' 
                THEN CAST(SUBSTRING(employee_id FROM 4) AS INTEGER)
                ELSE 0
            END
        ), 0) + 1
        INTO max_id
        FROM users;
        
        -- Generate new ID with zero-padding (EMP001, EMP002, etc.)
        new_id := 'EMP' || LPAD(max_id::TEXT, 3, '0');
        
        -- Check if this ID already exists
        IF NOT EXISTS (SELECT 1 FROM users WHERE employee_id = new_id) THEN
            RETURN new_id;
        END IF;
        
        -- Safety: prevent infinite loop
        attempts := attempts + 1;
        IF attempts > 100 THEN
            -- Fallback to timestamp-based ID
            new_id := 'EMP' || LPAD(EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT, 10, '0');
            RETURN new_id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function
CREATE OR REPLACE FUNCTION set_employee_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.employee_id IS NULL OR NEW.employee_id = '' THEN
        NEW.employee_id := generate_employee_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_set_employee_id
    BEFORE INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_employee_id();

-- Test: Verify the function works
SELECT generate_employee_id() AS test_id;

COMMENT ON FUNCTION generate_employee_id() IS 'Auto-generates unique sequential employee IDs (EMP001, EMP002, ...) with duplicate prevention';
COMMENT ON FUNCTION set_employee_id() IS 'Trigger function to auto-assign employee ID on user creation';
