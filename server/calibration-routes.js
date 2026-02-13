// ==================== CALIBRATION EXPENSE MANAGEMENT ====================
// Routes for Calibration department site visit expense tracking

import { Router } from 'express';

/**
 * Middleware to check if user belongs to Calibration department
 */
export const isCalibrationDept = (req, res, next) => {
    if (req.user.department !== 'Calibration') {
        return res.status(403).json({
            error: 'Access denied. Only Calibration department employees can access this resource.'
        });
    }
    next();
};

/**
 * Create new site visit with expenses
 * POST /api/calibration/site-visit
 */
export const createSiteVisit = async (req, res, pool) => {
    const client = await pool.connect();

    try {
        const {
            date,
            attendanceId,
            location,
            companyName,
            numGauges,
            visitSummary,
            conclusion,
            expenses
        } = req.body;

        const userId = req.user.id;

        // Validation
        if (!date || !attendanceId || !location) {
            return res.status(400).json({
                error: 'Date, attendance ID, and location are required'
            });
        }

        if (!expenses || expenses.length === 0) {
            return res.status(400).json({
                error: 'At least one expense item is required'
            });
        }

        await client.query('BEGIN');

        // Verify attendance belongs to user
        const attendanceCheck = await client.query(
            'SELECT id FROM attendance WHERE id = $1 AND user_id = $2',
            [attendanceId, userId]
        );

        if (attendanceCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Attendance record not found' });
        }

        // Check if site visit already exists for this attendance
        const existingVisit = await client.query(
            'SELECT id FROM site_visit_details WHERE attendance_id = $1',
            [attendanceId]
        );

        if (existingVisit.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                error: 'Site visit already exists for this date. Please update instead.'
            });
        }

        // Create site visit details
        const siteVisitResult = await client.query(
            `INSERT INTO site_visit_details (
                attendance_id, user_id, visit_date, location, company_name, 
                num_gauges, visit_summary, conclusion, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft')
            RETURNING id`,
            [attendanceId, userId, date, location, companyName || null,
                numGauges || 0, visitSummary || null, conclusion || null]
        );

        const siteVisitId = siteVisitResult.rows[0].id;

        // Insert expenses
        let totalExpenses = 0;
        for (const expense of expenses) {
            await client.query(
                `INSERT INTO site_visit_expenses (
                    site_visit_id, expense_type, amount, description, notes
                ) VALUES ($1, $2, $3, $4, $5)`,
                [siteVisitId, expense.type, expense.amount,
                    expense.description || null, expense.notes || null]
            );
            totalExpenses += parseFloat(expense.amount);
        }

        // Update attendance record
        await client.query(
            `UPDATE attendance 
             SET is_site_visit = true, 
                 site_location = $1,
                 site_visit_cost = $2
             WHERE id = $3`,
            [location, totalExpenses, attendanceId]
        );

        await client.query('COMMIT');

        // Log activity
        await pool.query(
            'INSERT INTO activity_log (user_id, action_type, action_details) VALUES ($1, $2, $3)',
            [userId, 'site_visit_created', `Created site visit for ${location} with ${expenses.length} expenses`]
        );

        res.status(201).json({
            success: true,
            siteVisitId,
            totalExpenses: totalExpenses.toFixed(2),
            message: 'Site visit details saved as draft'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error creating site visit:', error);
        res.status(500).json({ error: 'Failed to create site visit' });
    } finally {
        client.release();
    }
};

/**
 * Get site visit details for a specific date
 * GET /api/calibration/site-visit/:date
 */
export const getSiteVisitByDate = async (req, res, pool) => {
    try {
        const { date } = req.params;
        const userId = req.user.id;

        const result = await pool.query(
            `SELECT svd.*, 
                    array_agg(
                        json_build_object(
                            'id', sve.id,
                            'type', sve.expense_type,
                            'amount', sve.amount,
                            'description', sve.description,
                            'notes', sve.notes
                        )
                    ) FILTER (WHERE sve.id IS NOT NULL) as expenses
             FROM site_visit_details svd
             LEFT JOIN site_visit_expenses sve ON svd.id = sve.site_visit_id
             WHERE svd.user_id = $1 AND svd.visit_date = $2
             GROUP BY svd.id`,
            [userId, date]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Site visit not found' });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error('❌ Error fetching site visit:', error);
        res.status(500).json({ error: 'Failed to fetch site visit' });
    }
};

/**
 * Update site visit details
 * PUT /api/calibration/site-visit/:id
 */
export const updateSiteVisit = async (req, res, pool) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;
        const { location, companyName, numGauges, visitSummary, conclusion } = req.body;
        const userId = req.user.id;

        await client.query('BEGIN');

        // Check ownership and status
        const visitCheck = await client.query(
            'SELECT status FROM site_visit_details WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (visitCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Site visit not found' });
        }

        if (visitCheck.rows[0].status !== 'draft') {
            await client.query('ROLLBACK');
            return res.status(403).json({
                error: 'Cannot edit site visit after submission'
            });
        }

        // Update site visit
        await client.query(
            `UPDATE site_visit_details 
             SET location = $1, company_name = $2, num_gauges = $3, 
                 visit_summary = $4, conclusion = $5
             WHERE id = $6`,
            [location, companyName, numGauges, visitSummary, conclusion, id]
        );

        await client.query('COMMIT');

        res.json({ success: true, message: 'Site visit updated successfully' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error updating site visit:', error);
        res.status(500).json({ error: 'Failed to update site visit' });
    } finally {
        client.release();
    }
};

/**
 * Add expense to site visit
 * POST /api/calibration/site-visit/:id/expenses
 */
export const addExpense = async (req, res, pool) => {
    try {
        const { id } = req.params;
        const { type, amount, description, notes } = req.body;
        const userId = req.user.id;

        // Validation
        if (!type || !amount) {
            return res.status(400).json({ error: 'Expense type and amount are required' });
        }

        // Check ownership and status
        const visitCheck = await pool.query(
            'SELECT status FROM site_visit_details WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (visitCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Site visit not found' });
        }

        if (visitCheck.rows[0].status !== 'draft') {
            return res.status(403).json({
                error: 'Cannot add expenses after submission'
            });
        }

        // Insert expense
        const result = await pool.query(
            `INSERT INTO site_visit_expenses (
                site_visit_id, expense_type, amount, description, notes
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING id`,
            [id, type, amount, description || null, notes || null]
        );

        res.status(201).json({
            success: true,
            expenseId: result.rows[0].id,
            message: 'Expense added successfully'
        });

    } catch (error) {
        console.error('❌ Error adding expense:', error);
        res.status(500).json({ error: 'Failed to add expense' });
    }
};

/**
 * Update expense item
 * PUT /api/calibration/expenses/:id
 */
export const updateExpense = async (req, res, pool) => {
    try {
        const { id } = req.params;
        const { type, amount, description, notes } = req.body;
        const userId = req.user.id;

        // Check ownership through site visit
        const expenseCheck = await pool.query(
            `SELECT sve.id 
             FROM site_visit_expenses sve
             JOIN site_visit_details svd ON sve.site_visit_id = svd.id
             WHERE sve.id = $1 AND svd.user_id = $2 AND svd.status = 'draft'`,
            [id, userId]
        );

        if (expenseCheck.rows.length === 0) {
            return res.status(404).json({
                error: 'Expense not found or cannot be edited'
            });
        }

        // Update expense
        await pool.query(
            `UPDATE site_visit_expenses 
             SET expense_type = $1, amount = $2, description = $3, notes = $4
             WHERE id = $5`,
            [type, amount, description, notes, id]
        );

        res.json({ success: true, message: 'Expense updated successfully' });

    } catch (error) {
        console.error('❌ Error updating expense:', error);
        res.status(500).json({ error: 'Failed to update expense' });
    }
};

/**
 * Delete expense item
 * DELETE /api/calibration/expenses/:id
 */
export const deleteExpense = async (req, res, pool) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Check ownership through site visit
        const expenseCheck = await pool.query(
            `SELECT sve.id 
             FROM site_visit_expenses sve
             JOIN site_visit_details svd ON sve.site_visit_id = svd.id
             WHERE sve.id = $1 AND svd.user_id = $2 AND svd.status = 'draft'`,
            [id, userId]
        );

        if (expenseCheck.rows.length === 0) {
            return res.status(404).json({
                error: 'Expense not found or cannot be deleted'
            });
        }

        // Delete expense
        await pool.query('DELETE FROM site_visit_expenses WHERE id = $1', [id]);

        res.json({ success: true, message: 'Expense deleted successfully' });

    } catch (error) {
        console.error('❌ Error deleting expense:', error);
        res.status(500).json({ error: 'Failed to delete expense' });
    }
};

/**
 * Submit site visit for admin approval
 * POST /api/calibration/site-visit/:id/submit
 */
export const submitForApproval = async (req, res, pool) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;
        const userId = req.user.id;

        await client.query('BEGIN');

        // Check ownership and status
        const visitCheck = await client.query(
            `SELECT svd.*, 
                    (SELECT COUNT(*) FROM site_visit_expenses WHERE site_visit_id = svd.id) as expense_count,
                    (SELECT COALESCE(SUM(amount), 0) FROM site_visit_expenses WHERE site_visit_id = svd.id) as total_amount
             FROM site_visit_details svd
             WHERE svd.id = $1 AND svd.user_id = $2`,
            [id, userId]
        );

        if (visitCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Site visit not found' });
        }

        const visit = visitCheck.rows[0];

        if (visit.status !== 'draft') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: 'Site visit has already been submitted'
            });
        }

        if (visit.expense_count === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: 'Cannot submit without expenses. Please add at least one expense item.'
            });
        }

        // Update status to submitted
        await client.query(
            'UPDATE site_visit_details SET status = $1, submitted_at = CURRENT_TIMESTAMP WHERE id = $2',
            ['submitted', id]
        );

        // Create notification for admins
        const admins = await client.query(
            'SELECT id FROM users WHERE role = $1 AND is_active = true',
            ['admin']
        );

        for (const admin of admins.rows) {
            await client.query(
                `INSERT INTO notifications (user_id, type, title, message, link)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    admin.id,
                    'calibration_expense_submitted',
                    'New Site Visit Expense',
                    `${req.user.fullName || req.user.username} submitted expenses for ${visit.location} - Total: ₹${visit.total_amount}`,
                    '/admin/calibration'
                ]
            );
        }

        await client.query('COMMIT');

        // Log activity
        await pool.query(
            'INSERT INTO activity_log (user_id, action_type, action_details) VALUES ($1, $2, $3)',
            [userId, 'site_visit_submitted', `Submitted site visit for ${visit.location} - ₹${visit.total_amount}`]
        );

        res.json({
            success: true,
            message: 'Site visit submitted for approval. Admin will review your expenses.'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error submitting site visit:', error);
        res.status(500).json({ error: 'Failed to submit site visit' });
    } finally {
        client.release();
    }
};

/**
 * Get autocomplete suggestions
 * GET /api/calibration/autocomplete?type=location|company|expense_type
 */
export const getAutocompleteSuggestions = async (req, res, pool) => {
    try {
        const { type } = req.query;
        const userId = req.user.id;

        if (!type || !['location', 'company', 'expense_type'].includes(type)) {
            return res.status(400).json({
                error: 'Invalid type. Must be: location, company, or expense_type'
            });
        }

        const result = await pool.query(
            `SELECT DISTINCT value 
             FROM expense_autocomplete_data 
             WHERE type = $1
             ORDER BY usage_count DESC, value ASC
             LIMIT 20`,
            [type]
        );

        res.json(result.rows.map(row => row.value));

    } catch (error) {
        console.error('❌ Error fetching autocomplete:', error);
        res.status(500).json({ error: 'Failed to fetch suggestions' });
    }
};

/**
 * Get pending expense approvals (Admin only)
 * GET /api/admin/calibration/pending
 */
export const getPendingApprovals = async (req, res, pool) => {
    try {
        const result = await pool.query(
            'SELECT * FROM pending_calibration_approvals ORDER BY submitted_at ASC'
        );

        res.json(result.rows);

    } catch (error) {
        console.error('❌ Error fetching pending approvals:', error);
        res.status(500).json({ error: 'Failed to fetch pending approvals' });
    }
};

/**
 * Get calibration expense history (Admin only)
 * GET /api/admin/calibration/history
 */
export const getExpenseHistory = async (req, res, pool) => {
    try {
        const { status, userId, startDate, endDate } = req.query;

        let query = 'SELECT * FROM site_visit_history WHERE 1=1';
        const params = [];
        let paramCount = 1;

        if (status) {
            query += ` AND status = $${paramCount}`;
            params.push(status);
            paramCount++;
        }

        if (userId) {
            query += ` AND user_id = $${paramCount}`;
            params.push(userId);
            paramCount++;
        }

        if (startDate) {
            query += ` AND visit_date >= $${paramCount}`;
            params.push(startDate);
            paramCount++;
        }

        if (endDate) {
            query += ` AND visit_date <= $${paramCount}`;
            params.push(endDate);
            paramCount++;
        }

        query += ' ORDER BY visit_date DESC LIMIT 100';

        const result = await pool.query(query, params);
        res.json(result.rows);

    } catch (error) {
        console.error('❌ Error fetching expense history:', error);
        res.status(500).json({ error: 'Failed to fetch expense history' });
    }
};

/**
 * Approve site visit expense (Admin only)
 * PUT /api/admin/calibration/approve/:id
 */
export const approveExpense = async (req, res, pool) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;
        const adminId = req.user.id;

        await client.query('BEGIN');

        // Check if site visit exists and is pending
        const visitCheck = await client.query(
            `SELECT svd.*, u.full_name, u.telegram_id,
                    (SELECT COALESCE(SUM(amount), 0) FROM site_visit_expenses WHERE site_visit_id = svd.id) as total_amount
             FROM site_visit_details svd
             JOIN users u ON svd.user_id = u.id
             WHERE svd.id = $1`,
            [id]
        );

        if (visitCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Site visit not found' });
        }

        const visit = visitCheck.rows[0];

        if (visit.status !== 'submitted') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: `Cannot approve. Current status: ${visit.status}`
            });
        }

        // Update status to approved
        await client.query(
            `UPDATE site_visit_details 
             SET status = 'approved', reviewed_by = $1, reviewed_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [adminId, id]
        );

        // Notify employee
        await client.query(
            `INSERT INTO notifications (user_id, type, title, message, link)
             VALUES ($1, $2, $3, $4, $5)`,
            [
                visit.user_id,
                'calibration_expense_approved',
                'Site Visit Expense Approved',
                `Your expense claim for ${visit.location} (₹${visit.total_amount}) has been approved and will be reimbursed.`,
                '/calendar'
            ]
        );

        await client.query('COMMIT');

        // Log activity
        await pool.query(
            'INSERT INTO activity_log (user_id, action_type, action_details) VALUES ($1, $2, $3)',
            [adminId, 'expense_approved', `Approved ${visit.full_name}'s site visit expense for ${visit.location} - ₹${visit.total_amount}`]
        );

        console.log(`✅ Admin ${req.user.username} approved expense for ${visit.full_name} - ₹${visit.total_amount}`);

        res.json({
            success: true,
            message: 'Expense approved successfully'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error approving expense:', error);
        res.status(500).json({ error: 'Failed to approve expense' });
    } finally {
        client.release();
    }
};

/**
 * Reject site visit expense (Admin only)
 * PUT /api/admin/calibration/reject/:id
 */
export const rejectExpense = async (req, res, pool) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;
        const { reason } = req.body;
        const adminId = req.user.id;

        if (!reason) {
            return res.status(400).json({ error: 'Rejection reason is required' });
        }

        await client.query('BEGIN');

        // Check if site visit exists and is pending
        const visitCheck = await client.query(
            `SELECT svd.*, u.full_name,
                    (SELECT COALESCE(SUM(amount), 0) FROM site_visit_expenses WHERE site_visit_id = svd.id) as total_amount
             FROM site_visit_details svd
             JOIN users u ON svd.user_id = u.id
             WHERE svd.id = $1`,
            [id]
        );

        if (visitCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Site visit not found' });
        }

        const visit = visitCheck.rows[0];

        if (visit.status !== 'submitted') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: `Cannot reject. Current status: ${visit.status}`
            });
        }

        // Update status to rejected
        await client.query(
            `UPDATE site_visit_details 
             SET status = 'rejected', reviewed_by = $1, reviewed_at = CURRENT_TIMESTAMP, 
                 rejection_reason = $2
             WHERE id = $3`,
            [adminId, reason, id]
        );

        // Notify employee
        await client.query(
            `INSERT INTO notifications (user_id, type, title, message, link)
             VALUES ($1, $2, $3, $4, $5)`,
            [
                visit.user_id,
                'calibration_expense_rejected',
                'Site Visit Expense Rejected',
                `Your expense claim for ${visit.location} was rejected. Reason: ${reason}`,
                '/calendar'
            ]
        );

        await client.query('COMMIT');

        // Log activity
        await pool.query(
            'INSERT INTO activity_log (user_id, action_type, action_details) VALUES ($1, $2, $3)',
            [adminId, 'expense_rejected', `Rejected ${visit.full_name}'s site visit expense for ${visit.location} - Reason: ${reason}`]
        );

        console.log(`⚠️ Admin ${req.user.username} rejected expense for ${visit.full_name} - Reason: ${reason}`);

        res.json({
            success: true,
            message: 'Expense rejected'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error rejecting expense:', error);
        res.status(500).json({ error: 'Failed to reject expense' });
    } finally {
        client.release();
    }
};
