-- Fix attendance status check constraint
-- Add 'half_day' and 'leave' to allowed statuses

-- Drop old constraint
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;

-- Add new constraint with all valid statuses
ALTER TABLE attendance ADD CONSTRAINT attendance_status_check 
CHECK (status IN ('present', 'absent', 'wfh', 'half_day', 'on_leave', 'leave'));

-- Verify
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'attendance_status_check';
