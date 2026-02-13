-- ============================================================
-- Task Management System
-- Migration: 011_task_management.sql
-- Date: 2026-02-06
-- Description: Adds task/ticket management with email automation
-- ============================================================

-- ============================================================
-- TASKS TABLE - Core task/ticket storage
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  
  -- Basic info
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Assignment
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  
  -- Customer/External contact info (extracted from email)
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(50),
  company_name VARCHAR(255),
  
  -- Task classification
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status VARCHAR(30) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'pending', 'completed', 'cancelled')),
  category VARCHAR(100),
  
  -- Scheduling
  due_date DATE,
  due_time TIME,
  reminder_date DATE,
  reminder_time TIME,
  reminder_sent BOOLEAN DEFAULT false,
  
  -- Completion tracking
  completed_at TIMESTAMP,
  completed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  
  -- Email automation
  source_email_id VARCHAR(255),
  source_email_subject VARCHAR(500),
  send_completion_email BOOLEAN DEFAULT true,
  completion_email_sent BOOLEAN DEFAULT false,
  completion_email_sent_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for tasks
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_reminder_date ON tasks(reminder_date, reminder_sent);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_customer_email ON tasks(customer_email);

COMMENT ON TABLE tasks IS 'Task/ticket management with customer email integration';
COMMENT ON COLUMN tasks.source_email_id IS 'Original email message ID if created from email';
COMMENT ON COLUMN tasks.send_completion_email IS 'Whether to send notification email on completion';

-- ============================================================
-- TASK ATTACHMENTS - Files and drive links
-- ============================================================
CREATE TABLE IF NOT EXISTS task_attachments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  
  -- File info
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(100),
  file_size INTEGER,
  
  -- Storage options
  file_url TEXT,
  drive_link TEXT,
  
  -- Metadata
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for attachments
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);

COMMENT ON TABLE task_attachments IS 'File attachments and drive links for tasks';
COMMENT ON COLUMN task_attachments.drive_link IS 'Google Drive or other cloud storage link';

-- ============================================================
-- TASK COMMENTS - Activity and comments thread
-- ============================================================
CREATE TABLE IF NOT EXISTS task_comments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  
  -- Comment content
  comment TEXT NOT NULL,
  
  -- System vs user comment
  is_system_message BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for comments
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id, created_at);

COMMENT ON TABLE task_comments IS 'Comments and activity log for tasks';
COMMENT ON COLUMN task_comments.is_system_message IS 'True for auto-generated status change messages';

-- ============================================================
-- EMAIL QUEUE - Scheduled email sending
-- ============================================================
CREATE TABLE IF NOT EXISTS email_queue (
  id SERIAL PRIMARY KEY,
  
  -- Reference to task (optional, can be standalone emails)
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  
  -- Email type for categorization
  email_type VARCHAR(50) NOT NULL CHECK (email_type IN ('reminder', 'completion', 'assignment', 'due_soon', 'custom')),
  
  -- Email content
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  subject VARCHAR(500) NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  
  -- Scheduling
  scheduled_for TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Status tracking
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMP,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  
  -- Error tracking
  last_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for email queue
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_email_queue_task_id ON email_queue(task_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled ON email_queue(scheduled_for) WHERE status = 'pending';

COMMENT ON TABLE email_queue IS 'Scheduled emails for reminders and notifications';
COMMENT ON COLUMN email_queue.email_type IS 'Type of email: reminder, completion, assignment, due_soon, custom';

-- ============================================================
-- EMAIL TEMPLATES - Reusable email templates
-- ============================================================
CREATE TABLE IF NOT EXISTS email_templates (
  id SERIAL PRIMARY KEY,
  
  -- Template identification
  template_key VARCHAR(100) UNIQUE NOT NULL,
  template_name VARCHAR(255) NOT NULL,
  
  -- Template content
  subject_template VARCHAR(500) NOT NULL,
  body_html_template TEXT NOT NULL,
  body_text_template TEXT,
  
  -- Metadata
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE email_templates IS 'Reusable email templates with variable placeholders';
COMMENT ON COLUMN email_templates.template_key IS 'Unique identifier for referencing template in code';

-- ============================================================
-- SEED DATA - Default email templates
-- ============================================================
INSERT INTO email_templates (template_key, template_name, subject_template, body_html_template, body_text_template, description)
VALUES 
  (
    'task_completion',
    'Task Completion Notification',
    'Your request has been completed - {{task_title}}',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2d3748;">Task Completed ✓</h2>
      <p>Hello {{customer_name}},</p>
      <p>We are pleased to inform you that your request has been completed.</p>
      <div style="background: #f7fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <strong>Task:</strong> {{task_title}}<br>
        <strong>Completed on:</strong> {{completed_date}}<br>
        <strong>Handled by:</strong> {{completed_by}}
      </div>
      <p>If you have any questions or need further assistance, please don''t hesitate to reach out.</p>
      <p>Best regards,<br>{{company_name}}</p>
    </div>',
    'Task Completed

Hello {{customer_name}},

We are pleased to inform you that your request has been completed.

Task: {{task_title}}
Completed on: {{completed_date}}
Handled by: {{completed_by}}

If you have any questions or need further assistance, please don''t hesitate to reach out.

Best regards,
{{company_name}}',
    'Sent to customer when a task is marked as completed'
  ),
  (
    'task_reminder',
    'Task Due Reminder',
    'Reminder: Task "{{task_title}}" is due soon',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #ed8936;">⏰ Task Reminder</h2>
      <p>Hello {{assigned_to_name}},</p>
      <p>This is a reminder that the following task is due soon:</p>
      <div style="background: #fffaf0; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ed8936;">
        <strong>Task:</strong> {{task_title}}<br>
        <strong>Due Date:</strong> {{due_date}}<br>
        <strong>Priority:</strong> {{priority}}<br>
        <strong>Customer:</strong> {{customer_name}}
      </div>
      <p>Please ensure this task is completed on time.</p>
    </div>',
    'Task Reminder

Hello {{assigned_to_name}},

This is a reminder that the following task is due soon:

Task: {{task_title}}
Due Date: {{due_date}}
Priority: {{priority}}
Customer: {{customer_name}}

Please ensure this task is completed on time.',
    'Sent to assigned employee before task due date'
  ),
  (
    'task_assignment',
    'New Task Assignment',
    'New Task Assigned: {{task_title}}',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #3182ce;">📋 New Task Assigned</h2>
      <p>Hello {{assigned_to_name}},</p>
      <p>A new task has been assigned to you:</p>
      <div style="background: #ebf8ff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3182ce;">
        <strong>Task:</strong> {{task_title}}<br>
        <strong>Priority:</strong> {{priority}}<br>
        <strong>Due Date:</strong> {{due_date}}<br>
        <strong>Customer:</strong> {{customer_name}}<br>
        <strong>Assigned by:</strong> {{created_by_name}}
      </div>
      <p><strong>Description:</strong></p>
      <p>{{task_description}}</p>
    </div>',
    'New Task Assigned

Hello {{assigned_to_name}},

A new task has been assigned to you:

Task: {{task_title}}
Priority: {{priority}}
Due Date: {{due_date}}
Customer: {{customer_name}}
Assigned by: {{created_by_name}}

Description:
{{task_description}}',
    'Sent to employee when a task is assigned to them'
  )
ON CONFLICT (template_key) DO NOTHING;

-- ============================================================
-- VIEWS - Task dashboard stats
-- ============================================================
CREATE OR REPLACE VIEW task_dashboard_stats AS
SELECT 
  COUNT(*) FILTER (WHERE status = 'open') as open_count,
  COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= CURRENT_DATE) as completed_today,
  COUNT(*) FILTER (WHERE status != 'completed' AND status != 'cancelled' AND due_date < CURRENT_DATE) as overdue_count,
  COUNT(*) FILTER (WHERE status != 'completed' AND status != 'cancelled' AND due_date = CURRENT_DATE) as due_today,
  COUNT(*) FILTER (WHERE priority = 'urgent' AND status NOT IN ('completed', 'cancelled')) as urgent_count,
  COUNT(*) as total_tasks
FROM tasks;

COMMENT ON VIEW task_dashboard_stats IS 'Real-time task statistics for dashboard';

-- ============================================================
-- FUNCTIONS - Auto-update timestamp
-- ============================================================
CREATE OR REPLACE FUNCTION update_task_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for tasks table
DROP TRIGGER IF EXISTS trigger_update_task_timestamp ON tasks;
CREATE TRIGGER trigger_update_task_timestamp
BEFORE UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION update_task_timestamp();

-- Trigger for email_queue table
DROP TRIGGER IF EXISTS trigger_update_email_queue_timestamp ON email_queue;
CREATE TRIGGER trigger_update_email_queue_timestamp
BEFORE UPDATE ON email_queue
FOR EACH ROW
EXECUTE FUNCTION update_task_timestamp();

-- ============================================================
-- FUNCTION - Log task status changes
-- ============================================================
CREATE OR REPLACE FUNCTION log_task_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO task_comments (task_id, comment, is_system_message)
    VALUES (
      NEW.id, 
      'Status changed from ' || OLD.status || ' to ' || NEW.status,
      true
    );
  END IF;
  
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    INSERT INTO task_comments (task_id, comment, is_system_message)
    VALUES (
      NEW.id, 
      'Task reassigned',
      true
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_task_status_change ON tasks;
CREATE TRIGGER trigger_log_task_status_change
AFTER UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION log_task_status_change();

-- ============================================================
-- END OF MIGRATION
-- ============================================================
