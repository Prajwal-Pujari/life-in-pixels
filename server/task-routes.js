// Task Management Routes
// Handles CRUD operations for tasks with customer grouping, email verification, and Telegram integration

import { randomBytes } from 'crypto';

// Email verification codes storage (in-memory, cleared on restart)
const emailVerificationCodes = new Map();

// ============================================================
// EMAIL VERIFICATION HELPERS
// ============================================================

function generateVerificationCode() {
    return randomBytes(3).toString('hex').toUpperCase(); // 6-character code
}

// Store verification code with expiry
function storeVerificationCode(email, code) {
    emailVerificationCodes.set(email.toLowerCase(), {
        code,
        expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
        verified: false
    });
}

// Verify the code
function verifyEmailCode(email, code) {
    const stored = emailVerificationCodes.get(email.toLowerCase());
    if (!stored) return { valid: false, error: 'No verification pending for this email' };
    if (Date.now() > stored.expiresAt) {
        emailVerificationCodes.delete(email.toLowerCase());
        return { valid: false, error: 'Verification code expired' };
    }
    if (stored.code !== code.toUpperCase()) {
        return { valid: false, error: 'Invalid verification code' };
    }
    stored.verified = true;
    return { valid: true };
}

// Check if email is verified
function isEmailVerified(email) {
    const stored = emailVerificationCodes.get(email.toLowerCase());
    return stored && stored.verified;
}

// ============================================================
// TELEGRAM NOTIFICATION HELPERS
// ============================================================

async function sendTaskReminderToEmployee(bot, pool, task, employee) {
    if (!bot || !employee.telegram_id) {
        console.log(`⚠️ Cannot send reminder: Bot not available or employee has no Telegram ID`);
        return false;
    }

    const message = `🔔 <b>TASK REMINDER</b>\n\n` +
        `📋 <b>${task.title}</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `👤 Customer: ${task.customer_name || 'N/A'}\n` +
        `🏢 Company: ${task.company_name || 'N/A'}\n` +
        `📧 Email: ${task.customer_email || 'N/A'}\n` +
        `📅 Due: ${task.due_date ? new Date(task.due_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'No due date'}\n` +
        `⚡ Priority: ${task.priority.toUpperCase()}\n\n` +
        `📝 ${task.description || 'No description'}\n\n` +
        `<i>Please complete this task on time.</i>`;

    try {
        await bot.sendMessage(employee.telegram_id, message, { parse_mode: 'HTML' });
        console.log(`📱 Task reminder sent to ${employee.full_name} via Telegram`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send task reminder:`, error.message);
        return false;
    }
}

async function sendTaskAssignmentNotification(bot, pool, task, assignee, assigner) {
    if (!bot || !assignee.telegram_id) {
        return false;
    }

    const message = `📋 <b>NEW TASK ASSIGNED</b>\n\n` +
        `📌 <b>${task.title}</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `👤 Customer: ${task.customer_name || 'N/A'}\n` +
        `🏢 Company: ${task.company_name || 'N/A'}\n` +
        `📅 Due: ${task.due_date ? new Date(task.due_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'No due date'}\n` +
        `⚡ Priority: ${task.priority.toUpperCase()}\n` +
        `👨‍💼 Assigned by: ${assigner.full_name}\n\n` +
        `📝 ${task.description || 'No description'}`;

    try {
        await bot.sendMessage(assignee.telegram_id, message, { parse_mode: 'HTML' });
        return true;
    } catch (error) {
        console.error(`❌ Failed to send assignment notification:`, error.message);
        return false;
    }
}

async function sendTaskCompletionNotification(bot, pool, task, completedBy) {
    if (!bot) return false;

    // Get admin chat ID for completion notifications  
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!chatId) return false;

    const message = `✅ <b>TASK COMPLETED</b>\n\n` +
        `📋 <b>${task.title}</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `👤 Customer: ${task.customer_name || 'N/A'}\n` +
        `🏢 Company: ${task.company_name || 'N/A'}\n` +
        `📧 Email: ${task.customer_email || 'N/A'}\n` +
        `✔️ Completed by: ${completedBy.full_name}\n` +
        `📅 Completed: ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}\n\n` +
        `📝 Resolution: ${task.resolution_notes || 'No notes added'}`;

    try {
        await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
        return true;
    } catch (error) {
        console.error(`❌ Failed to send completion notification:`, error.message);
        return false;
    }
}

// ============================================================
// ROUTE SETUP
// ============================================================

export function setupTaskRoutes(app, pool, authenticateToken, isAdmin, telegramBot) {

    // ========================================
    // GET /api/tasks - List all tasks
    // ========================================
    app.get('/api/tasks', authenticateToken, async (req, res) => {
        try {
            const { status, priority, assigned_to, customer, from_date, to_date, search } = req.query;
            const userId = req.user.id;
            const isUserAdmin = req.user.role === 'admin';

            let query = `
                SELECT t.*,
                    u_assigned.full_name as assigned_to_name,
                    u_assigned.employee_id as assigned_to_employee_id,
                    u_created.full_name as created_by_name,
                    (SELECT COUNT(*) FROM task_comments WHERE task_id = t.id) as comment_count,
                    (SELECT COUNT(*) FROM task_attachments WHERE task_id = t.id) as attachment_count
                FROM tasks t
                LEFT JOIN users u_assigned ON t.assigned_to = u_assigned.id
                LEFT JOIN users u_created ON t.created_by = u_created.id
                WHERE 1=1
            `;
            const params = [];
            let paramIndex = 1;

            // Non-admin users only see their assigned tasks
            if (!isUserAdmin) {
                query += ` AND t.assigned_to = $${paramIndex++}`;
                params.push(userId);
            }

            // Filters
            if (status && status !== 'all') {
                query += ` AND t.status = $${paramIndex++}`;
                params.push(status);
            }
            if (priority && priority !== 'all') {
                query += ` AND t.priority = $${paramIndex++}`;
                params.push(priority);
            }
            if (assigned_to) {
                query += ` AND t.assigned_to = $${paramIndex++}`;
                params.push(assigned_to);
            }
            if (customer) {
                query += ` AND (t.customer_name ILIKE $${paramIndex} OR t.company_name ILIKE $${paramIndex})`;
                params.push(`%${customer}%`);
                paramIndex++;
            }
            if (from_date) {
                query += ` AND t.due_date >= $${paramIndex++}`;
                params.push(from_date);
            }
            if (to_date) {
                query += ` AND t.due_date <= $${paramIndex++}`;
                params.push(to_date);
            }
            if (search) {
                query += ` AND (t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`;
                params.push(`%${search}%`);
                paramIndex++;
            }

            query += ` ORDER BY 
                CASE t.priority 
                    WHEN 'urgent' THEN 1 
                    WHEN 'high' THEN 2 
                    WHEN 'medium' THEN 3 
                    ELSE 4 
                END,
                t.due_date ASC NULLS LAST,
                t.created_at DESC`;

            const result = await pool.query(query, params);
            res.json(result.rows);
        } catch (error) {
            console.error('❌ Error fetching tasks:', error);
            res.status(500).json({ error: 'Failed to fetch tasks' });
        }
    });

    // ========================================
    // GET /api/tasks/calendar - Tasks for calendar view
    // ========================================
    app.get('/api/tasks/calendar', authenticateToken, async (req, res) => {
        try {
            const { month } = req.query; // Format: YYYY-MM
            const userId = req.user.id;
            const isUserAdmin = req.user.role === 'admin';

            if (!month) {
                return res.status(400).json({ error: 'Month parameter required (YYYY-MM)' });
            }

            let query = `
                SELECT t.id, t.title, t.due_date, t.priority, t.status, 
                       t.customer_name, t.company_name,
                       u.full_name as assigned_to_name
                FROM tasks t
                LEFT JOIN users u ON t.assigned_to = u.id
                WHERE t.due_date IS NOT NULL
                AND TO_CHAR(t.due_date, 'YYYY-MM') = $1
                AND t.status NOT IN ('cancelled')
            `;
            const params = [month];

            if (!isUserAdmin) {
                query += ` AND t.assigned_to = $2`;
                params.push(userId);
            }

            query += ` ORDER BY t.due_date, t.priority`;

            const result = await pool.query(query, params);
            res.json(result.rows);
        } catch (error) {
            console.error('❌ Error fetching calendar tasks:', error);
            res.status(500).json({ error: 'Failed to fetch calendar tasks' });
        }
    });

    // ========================================
    // GET /api/tasks/dashboard - Dashboard stats
    // ========================================
    app.get('/api/tasks/dashboard', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const isUserAdmin = req.user.role === 'admin';

            let whereClause = '';
            const params = [];

            if (!isUserAdmin) {
                whereClause = 'WHERE assigned_to = $1';
                params.push(userId);
            }

            const statsQuery = `
                SELECT 
                    COUNT(*) FILTER (WHERE status = 'open') as open_count,
                    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
                    COUNT(*) FILTER (WHERE status = 'completed' AND DATE(completed_at) = CURRENT_DATE) as completed_today,
                    COUNT(*) FILTER (WHERE status NOT IN ('completed', 'cancelled') AND due_date < CURRENT_DATE) as overdue_count,
                    COUNT(*) FILTER (WHERE status NOT IN ('completed', 'cancelled') AND due_date = CURRENT_DATE) as due_today,
                    COUNT(*) FILTER (WHERE priority = 'urgent' AND status NOT IN ('completed', 'cancelled')) as urgent_count,
                    COUNT(*) as total_tasks
                FROM tasks
                ${whereClause}
            `;

            const recentTasksQuery = `
                SELECT t.id, t.title, t.status, t.priority, t.due_date, t.customer_name,
                       u.full_name as assigned_to_name
                FROM tasks t
                LEFT JOIN users u ON t.assigned_to = u.id
                ${whereClause}
                ORDER BY t.created_at DESC
                LIMIT 5
            `;

            const upcomingTasksQuery = `
                SELECT t.id, t.title, t.status, t.priority, t.due_date, t.customer_name,
                       u.full_name as assigned_to_name
                FROM tasks t
                LEFT JOIN users u ON t.assigned_to = u.id
                ${whereClause ? whereClause + ' AND' : 'WHERE'} t.status NOT IN ('completed', 'cancelled')
                AND t.due_date >= CURRENT_DATE
                ORDER BY t.due_date ASC
                LIMIT 5
            `;

            const [statsResult, recentResult, upcomingResult] = await Promise.all([
                pool.query(statsQuery, params),
                pool.query(recentTasksQuery, params),
                pool.query(upcomingTasksQuery, params)
            ]);

            res.json({
                stats: statsResult.rows[0],
                recentTasks: recentResult.rows,
                upcomingTasks: upcomingResult.rows
            });
        } catch (error) {
            console.error('❌ Error fetching dashboard:', error);
            res.status(500).json({ error: 'Failed to fetch dashboard' });
        }
    });

    // ========================================
    // GET /api/tasks/:id - Get single task
    // ========================================
    app.get('/api/tasks/:id', authenticateToken, async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const isUserAdmin = req.user.role === 'admin';

            const taskQuery = `
                SELECT t.*,
                    u_assigned.full_name as assigned_to_name,
                    u_assigned.employee_id as assigned_to_employee_id,
                    u_assigned.email as assigned_to_email,
                    u_created.full_name as created_by_name,
                    u_completed.full_name as completed_by_name
                FROM tasks t
                LEFT JOIN users u_assigned ON t.assigned_to = u_assigned.id
                LEFT JOIN users u_created ON t.created_by = u_created.id
                LEFT JOIN users u_completed ON t.completed_by = u_completed.id
                WHERE t.id = $1
            `;

            const result = await pool.query(taskQuery, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Task not found' });
            }

            const task = result.rows[0];

            // Non-admin can only view their assigned tasks
            if (!isUserAdmin && task.assigned_to !== userId) {
                return res.status(403).json({ error: 'Access denied' });
            }

            // Get comments
            const commentsResult = await pool.query(`
                SELECT c.*, u.full_name as user_name
                FROM task_comments c
                LEFT JOIN users u ON c.user_id = u.id
                WHERE c.task_id = $1
                ORDER BY c.created_at ASC
            `, [id]);

            // Get attachments
            const attachmentsResult = await pool.query(`
                SELECT a.*, u.full_name as uploaded_by_name
                FROM task_attachments a
                LEFT JOIN users u ON a.uploaded_by = u.id
                WHERE a.task_id = $1
                ORDER BY a.created_at DESC
            `, [id]);

            res.json({
                ...task,
                comments: commentsResult.rows,
                attachments: attachmentsResult.rows
            });
        } catch (error) {
            console.error('❌ Error fetching task:', error);
            res.status(500).json({ error: 'Failed to fetch task' });
        }
    });

    // ========================================
    // POST /api/tasks/verify-email - Send verification code
    // ========================================
    app.post('/api/tasks/verify-email', authenticateToken, async (req, res) => {
        try {
            const { email } = req.body;

            if (!email || !email.includes('@')) {
                return res.status(400).json({ error: 'Valid email required' });
            }

            const code = generateVerificationCode();
            storeVerificationCode(email, code);

            // Send via Telegram to admin group
            if (telegramBot && process.env.TELEGRAM_ENABLED === 'true') {
                const chatId = process.env.TELEGRAM_CHAT_ID;
                if (chatId) {
                    const message = `📧 <b>EMAIL VERIFICATION</b>\n\n` +
                        `Email: <code>${email}</code>\n` +
                        `Verification Code: <code>${code}</code>\n\n` +
                        `<i>Code expires in 15 minutes</i>\n` +
                        `<i>Requested by: ${req.user.full_name}</i>`;

                    await telegramBot.sendMessage(chatId, message, { parse_mode: 'HTML' });
                }
            }

            console.log(`📧 Verification code for ${email}: ${code}`);

            res.json({
                success: true,
                message: 'Verification code sent to Telegram',
                // For development, include code (remove in production)
                ...(process.env.NODE_ENV === 'development' && { code })
            });
        } catch (error) {
            console.error('❌ Error sending verification:', error);
            res.status(500).json({ error: 'Failed to send verification code' });
        }
    });

    // ========================================
    // POST /api/tasks/confirm-email - Confirm verification code
    // ========================================
    app.post('/api/tasks/confirm-email', authenticateToken, async (req, res) => {
        try {
            const { email, code } = req.body;

            if (!email || !code) {
                return res.status(400).json({ error: 'Email and code required' });
            }

            const result = verifyEmailCode(email, code);

            if (!result.valid) {
                return res.status(400).json({ error: result.error });
            }

            res.json({ success: true, message: 'Email verified successfully' });
        } catch (error) {
            console.error('❌ Error confirming email:', error);
            res.status(500).json({ error: 'Failed to confirm email' });
        }
    });

    // ========================================
    // POST /api/tasks - Create new task
    // ========================================
    app.post('/api/tasks', authenticateToken, async (req, res) => {
        try {
            const {
                title, description, assigned_to, customer_name, customer_email,
                customer_phone, company_name, priority, category, due_date,
                due_time, reminder_date, reminder_time, send_completion_email,
                attachments, verify_email
            } = req.body;

            if (!title) {
                return res.status(400).json({ error: 'Task title is required' });
            }

            // Check email verification if required
            if (verify_email && customer_email && !isEmailVerified(customer_email)) {
                return res.status(400).json({
                    error: 'Customer email must be verified before creating task',
                    requiresVerification: true
                });
            }

            const result = await pool.query(`
                INSERT INTO tasks (
                    title, description, assigned_to, created_by,
                    customer_name, customer_email, customer_phone, company_name,
                    priority, category, due_date, due_time,
                    reminder_date, reminder_time, send_completion_email
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                RETURNING *
            `, [
                title, description, assigned_to, req.user.id,
                customer_name, customer_email, customer_phone, company_name,
                priority || 'medium', category, due_date, due_time,
                reminder_date, reminder_time, send_completion_email !== false
            ]);

            const newTask = result.rows[0];

            // Add initial comment
            await pool.query(`
                INSERT INTO task_comments (task_id, user_id, comment, is_system_message)
                VALUES ($1, $2, $3, true)
            `, [newTask.id, req.user.id, 'Task created']);

            // Handle attachments
            if (attachments && attachments.length > 0) {
                for (const att of attachments) {
                    await pool.query(`
                        INSERT INTO task_attachments (task_id, file_name, file_type, file_url, drive_link, uploaded_by)
                        VALUES ($1, $2, $3, $4, $5, $6)
                    `, [newTask.id, att.file_name, att.file_type, att.file_url, att.drive_link, req.user.id]);
                }
            }

            // Send Telegram notification to assigned employee
            if (assigned_to && telegramBot) {
                const assigneeResult = await pool.query(
                    'SELECT id, full_name, telegram_id FROM users WHERE id = $1',
                    [assigned_to]
                );
                if (assigneeResult.rows.length > 0) {
                    await sendTaskAssignmentNotification(
                        telegramBot, pool, newTask,
                        assigneeResult.rows[0], req.user
                    );
                }
            }

            // Log activity
            await pool.query(`
                INSERT INTO activity_log (user_id, action_type, action_details)
                VALUES ($1, 'create_task', $2)
            `, [req.user.id, `Created task: ${title}`]);

            res.status(201).json(newTask);
        } catch (error) {
            console.error('❌ Error creating task:', error);
            res.status(500).json({ error: 'Failed to create task' });
        }
    });

    // ========================================
    // PUT /api/tasks/:id - Update task
    // ========================================
    app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const isUserAdmin = req.user.role === 'admin';

            // Check if task exists and user has access
            const existingTask = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
            if (existingTask.rows.length === 0) {
                return res.status(404).json({ error: 'Task not found' });
            }

            if (!isUserAdmin && existingTask.rows[0].assigned_to !== userId) {
                return res.status(403).json({ error: 'Access denied' });
            }

            const {
                title, description, assigned_to, customer_name, customer_email,
                customer_phone, company_name, priority, status, category,
                due_date, due_time, reminder_date, reminder_time,
                resolution_notes, send_completion_email
            } = req.body;

            const result = await pool.query(`
                UPDATE tasks SET
                    title = COALESCE($1, title),
                    description = COALESCE($2, description),
                    assigned_to = COALESCE($3, assigned_to),
                    customer_name = COALESCE($4, customer_name),
                    customer_email = COALESCE($5, customer_email),
                    customer_phone = COALESCE($6, customer_phone),
                    company_name = COALESCE($7, company_name),
                    priority = COALESCE($8, priority),
                    status = COALESCE($9, status),
                    category = COALESCE($10, category),
                    due_date = COALESCE($11, due_date),
                    due_time = COALESCE($12, due_time),
                    reminder_date = COALESCE($13, reminder_date),
                    reminder_time = COALESCE($14, reminder_time),
                    resolution_notes = COALESCE($15, resolution_notes),
                    send_completion_email = COALESCE($16, send_completion_email)
                WHERE id = $17
                RETURNING *
            `, [
                title, description, assigned_to, customer_name, customer_email,
                customer_phone, company_name, priority, status, category,
                due_date, due_time, reminder_date, reminder_time,
                resolution_notes, send_completion_email, id
            ]);

            res.json(result.rows[0]);
        } catch (error) {
            console.error('❌ Error updating task:', error);
            res.status(500).json({ error: 'Failed to update task' });
        }
    });

    // ========================================
    // PUT /api/tasks/:id/status - Update task status
    // ========================================
    app.put('/api/tasks/:id/status', authenticateToken, async (req, res) => {
        try {
            const { id } = req.params;
            const { status, resolution_notes } = req.body;
            const userId = req.user.id;
            const isUserAdmin = req.user.role === 'admin';

            // Get existing task
            const existingTask = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
            if (existingTask.rows.length === 0) {
                return res.status(404).json({ error: 'Task not found' });
            }

            const task = existingTask.rows[0];
            if (!isUserAdmin && task.assigned_to !== userId) {
                return res.status(403).json({ error: 'Access denied' });
            }

            let updateFields = { status };

            // If completing the task
            if (status === 'completed') {
                updateFields.completed_at = new Date();
                updateFields.completed_by = userId;
                if (resolution_notes) {
                    updateFields.resolution_notes = resolution_notes;
                }
            }

            const result = await pool.query(`
                UPDATE tasks SET
                    status = $1,
                    completed_at = $2,
                    completed_by = $3,
                    resolution_notes = COALESCE($4, resolution_notes)
                WHERE id = $5
                RETURNING *
            `, [status, updateFields.completed_at || null, updateFields.completed_by || null, resolution_notes, id]);

            const updatedTask = result.rows[0];

            // Send completion notification to Telegram
            if (status === 'completed' && telegramBot) {
                await sendTaskCompletionNotification(telegramBot, pool, updatedTask, req.user);
            }

            res.json(updatedTask);
        } catch (error) {
            console.error('❌ Error updating task status:', error);
            res.status(500).json({ error: 'Failed to update task status' });
        }
    });

    // ========================================
    // POST /api/tasks/:id/comments - Add comment
    // ========================================
    app.post('/api/tasks/:id/comments', authenticateToken, async (req, res) => {
        try {
            const { id } = req.params;
            const { comment } = req.body;
            const userId = req.user.id;

            if (!comment || !comment.trim()) {
                return res.status(400).json({ error: 'Comment is required' });
            }

            const result = await pool.query(`
                INSERT INTO task_comments (task_id, user_id, comment)
                VALUES ($1, $2, $3)
                RETURNING *, (SELECT full_name FROM users WHERE id = $2) as user_name
            `, [id, userId, comment.trim()]);

            res.status(201).json(result.rows[0]);
        } catch (error) {
            console.error('❌ Error adding comment:', error);
            res.status(500).json({ error: 'Failed to add comment' });
        }
    });

    // ========================================
    // POST /api/tasks/:id/attachments - Add attachment
    // ========================================
    app.post('/api/tasks/:id/attachments', authenticateToken, async (req, res) => {
        try {
            const { id } = req.params;
            const { file_name, file_type, file_url, drive_link } = req.body;
            const userId = req.user.id;

            if (!file_name && !drive_link) {
                return res.status(400).json({ error: 'File name or drive link required' });
            }

            const result = await pool.query(`
                INSERT INTO task_attachments (task_id, file_name, file_type, file_url, drive_link, uploaded_by)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *, (SELECT full_name FROM users WHERE id = $6) as uploaded_by_name
            `, [id, file_name || 'Drive Link', file_type, file_url, drive_link, userId]);

            res.status(201).json(result.rows[0]);
        } catch (error) {
            console.error('❌ Error adding attachment:', error);
            res.status(500).json({ error: 'Failed to add attachment' });
        }
    });

    // ========================================
    // DELETE /api/tasks/:id - Delete task
    // ========================================
    app.delete('/api/tasks/:id', authenticateToken, isAdmin, async (req, res) => {
        try {
            const { id } = req.params;

            const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING *', [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Task not found' });
            }

            res.json({ success: true, message: 'Task deleted' });
        } catch (error) {
            console.error('❌ Error deleting task:', error);
            res.status(500).json({ error: 'Failed to delete task' });
        }
    });

    // ========================================
    // GET /api/tasks/customers/list - Get unique customers
    // ========================================
    app.get('/api/tasks/customers/list', authenticateToken, async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT DISTINCT ON (customer_email) 
                    customer_name, customer_email, customer_phone, company_name
                FROM tasks
                WHERE customer_email IS NOT NULL
                ORDER BY customer_email, created_at DESC
            `);

            res.json(result.rows);
        } catch (error) {
            console.error('❌ Error fetching customers:', error);
            res.status(500).json({ error: 'Failed to fetch customers' });
        }
    });

    console.log('✅ Task routes initialized');
}

// ============================================================
// CRON JOB - Send task reminders
// ============================================================
export async function processTaskReminders(pool, telegramBot) {
    if (!telegramBot || process.env.TELEGRAM_ENABLED !== 'true') {
        return;
    }

    try {
        // Get tasks with reminders due
        const result = await pool.query(`
            SELECT t.*, u.full_name, u.telegram_id
            FROM tasks t
            JOIN users u ON t.assigned_to = u.id
            WHERE t.reminder_sent = false
            AND t.status NOT IN ('completed', 'cancelled')
            AND t.reminder_date IS NOT NULL
            AND (
                (t.reminder_date < CURRENT_DATE) OR
                (t.reminder_date = CURRENT_DATE AND t.reminder_time <= CURRENT_TIME)
            )
        `);

        for (const task of result.rows) {
            if (task.telegram_id) {
                const sent = await sendTaskReminderToEmployee(telegramBot, pool, task, {
                    full_name: task.full_name,
                    telegram_id: task.telegram_id
                });

                if (sent) {
                    await pool.query(
                        'UPDATE tasks SET reminder_sent = true WHERE id = $1',
                        [task.id]
                    );
                }
            }
        }

        console.log(`⏰ Processed ${result.rows.length} task reminders`);
    } catch (error) {
        console.error('❌ Error processing task reminders:', error);
    }
}

// Export for use in cron jobs
export { sendTaskReminderToEmployee, sendTaskCompletionNotification };
