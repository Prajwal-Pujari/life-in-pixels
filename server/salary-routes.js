// ==================== SALARY ROUTES ====================
// API routes for salary/payment tracking
// Admin can add payments, all users can view their own
// SALARY AMOUNTS ARE ENCRYPTED in the database for security
// IMPORTANT: Specific routes MUST come before parameterized routes!

import express from 'express';
import ExcelJS from 'exceljs';
import { encryptAmount, decryptAmount, isEncryptionConfigured } from './encryption.js';

const router = express.Router();
let pool = null;

export function setSalaryPool(dbPool) {
    pool = dbPool;
}

// Middleware to check if user is admin
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

// Helper to decrypt payment records
function decryptPayments(payments) {
    return payments.map(p => ({
        ...p,
        amount: decryptAmount(p.encrypted_amount),
        encrypted_amount: undefined // Don't expose encrypted value
    }));
}

// ==================== SPECIFIC ROUTES FIRST ====================
// These must come BEFORE /:userId to avoid route conflicts

/**
 * GET /api/salary/summary/all
 * Get summary for all employees (admin only)
 */
router.get('/summary/all', requireAdmin, async (req, res) => {
    try {
        // Get all users
        const users = await pool.query(
            `SELECT id, full_name, employee_id, department, joining_date 
             FROM users WHERE is_active = true ORDER BY full_name`
        );

        // Get all payments and decrypt
        const payments = await pool.query(
            `SELECT user_id, encrypted_amount, payment_type FROM salary_payments`
        );

        // Build summary per user
        const summaryMap = {};
        users.rows.forEach(u => {
            summaryMap[u.id] = {
                id: u.id,
                full_name: u.full_name,
                employee_id: u.employee_id,
                department: u.department,
                joining_date: u.joining_date,
                total_payments: 0,
                total_amount_paid: 0
            };
        });

        payments.rows.forEach(p => {
            if (summaryMap[p.user_id]) {
                summaryMap[p.user_id].total_payments++;
                summaryMap[p.user_id].total_amount_paid += decryptAmount(p.encrypted_amount);
            }
        });

        res.json(Object.values(summaryMap));

    } catch (error) {
        console.error('Error fetching salary summary:', error);
        res.status(500).json({ error: 'Failed to fetch summary' });
    }
});

/**
 * GET /api/salary/anniversaries/upcoming
 * Get upcoming work anniversaries (admin only)
 */
router.get('/anniversaries/upcoming', requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM upcoming_anniversaries WHERE days_until_anniversary >= 0 LIMIT 10`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching anniversaries:', error);
        res.status(500).json({ error: 'Failed to fetch anniversaries' });
    }
});

/**
 * PUT /api/salary/payment/:paymentId
 * Update a payment record (admin only)
 */
router.put('/payment/:paymentId', requireAdmin, async (req, res) => {
    try {
        const { paymentId } = req.params;
        const { amount, payment_date, payment_type, payment_month, notes } = req.body;

        // Build update query dynamically
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (amount !== undefined) {
            const encryptedAmount = encryptAmount(amount);
            updates.push(`encrypted_amount = $${paramCount++}`);
            values.push(encryptedAmount);
        }
        if (payment_date !== undefined) {
            updates.push(`payment_date = $${paramCount++}`);
            values.push(payment_date);
        }
        if (payment_type !== undefined) {
            updates.push(`payment_type = $${paramCount++}`);
            values.push(payment_type);
        }
        if (payment_month !== undefined) {
            updates.push(`payment_month = $${paramCount++}`);
            values.push(payment_month);
        }
        if (notes !== undefined) {
            updates.push(`notes = $${paramCount++}`);
            values.push(notes);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updates.push('updated_at = NOW()');
        values.push(paymentId);

        const result = await pool.query(
            `UPDATE salary_payments 
             SET ${updates.join(', ')}
             WHERE id = $${paramCount}
             RETURNING id, user_id, payment_date, payment_type, payment_month, notes, updated_at`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        res.json({
            message: 'Payment updated',
            payment: { ...result.rows[0], amount }
        });

    } catch (error) {
        console.error('Error updating payment:', error);
        res.status(500).json({ error: 'Failed to update payment' });
    }
});

/**
 * DELETE /api/salary/payment/:paymentId
 * Delete a payment record (admin only)
 */
router.delete('/payment/:paymentId', requireAdmin, async (req, res) => {
    try {
        const { paymentId } = req.params;

        const result = await pool.query(
            'DELETE FROM salary_payments WHERE id = $1 RETURNING id',
            [paymentId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        res.json({ message: 'Payment deleted' });

    } catch (error) {
        console.error('Error deleting payment:', error);
        res.status(500).json({ error: 'Failed to delete payment' });
    }
});

/**
 * PUT /api/salary/joining-date/:userId
 * Update employee joining date (admin only)
 */
router.put('/joining-date/:userId', requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { joining_date } = req.body;

        const result = await pool.query(
            `UPDATE users SET joining_date = $1 WHERE id = $2 RETURNING id, full_name, joining_date`,
            [joining_date, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Log activity
        await pool.query(
            'INSERT INTO activity_log (user_id, action_type, action_details) VALUES ($1, $2, $3)',
            [req.user.id, 'joining_date_updated', `Updated joining date for ${result.rows[0].full_name} to ${joining_date}`]
        );

        res.json({
            message: 'Joining date updated',
            user: result.rows[0]
        });

    } catch (error) {
        console.error('Error updating joining date:', error);
        res.status(500).json({ error: 'Failed to update joining date' });
    }
});

/**
 * GET /api/salary/export/:userId
 * Export salary history to Excel (with decrypted amounts)
 */
router.get('/export/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const requesterId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        // Check permission
        if (!isAdmin && parseInt(userId) !== requesterId) {
            return res.status(403).json({ error: 'You can only export your own salary history' });
        }

        // Get user info
        const userInfo = await pool.query(
            'SELECT full_name, employee_id FROM users WHERE id = $1',
            [userId]
        );
        if (userInfo.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const user = userInfo.rows[0];

        // Get payments (encrypted)
        const payments = await pool.query(
            `SELECT encrypted_amount, payment_date, payment_type, payment_month, notes, created_at
             FROM salary_payments
             WHERE user_id = $1
             ORDER BY payment_date DESC`,
            [userId]
        );

        // Create workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Life In Pixels';
        workbook.created = new Date();

        const worksheet = workbook.addWorksheet('Salary History');

        // Header
        worksheet.mergeCells('A1:F1');
        worksheet.getCell('A1').value = `Salary History - ${user.full_name} (${user.employee_id})`;
        worksheet.getCell('A1').font = { bold: true, size: 14 };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        // Column headers
        worksheet.getRow(3).values = ['Date', 'Amount (₹)', 'Type', 'For Month', 'Notes', 'Recorded On'];
        worksheet.getRow(3).font = { bold: true };
        worksheet.getRow(3).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Set column widths
        worksheet.columns = [
            { key: 'date', width: 12 },
            { key: 'amount', width: 15 },
            { key: 'type', width: 15 },
            { key: 'month', width: 12 },
            { key: 'notes', width: 30 },
            { key: 'recorded', width: 15 }
        ];

        // Data rows - DECRYPT amounts
        let totalAmount = 0;
        payments.rows.forEach((payment, index) => {
            const decryptedAmount = decryptAmount(payment.encrypted_amount);
            const row = worksheet.getRow(4 + index);
            row.values = [
                new Date(payment.payment_date).toLocaleDateString('en-IN'),
                decryptedAmount,
                payment.payment_type,
                payment.payment_month || '-',
                payment.notes || '-',
                new Date(payment.created_at).toLocaleDateString('en-IN')
            ];
            totalAmount += decryptedAmount;
            row.getCell(2).numFmt = '₹#,##0.00';
        });

        // Total row
        const totalRow = worksheet.getRow(5 + payments.rows.length);
        totalRow.values = ['Total', totalAmount, '', '', '', ''];
        totalRow.font = { bold: true };
        totalRow.getCell(2).numFmt = '₹#,##0.00';

        // Generate buffer
        const buffer = await workbook.xlsx.writeBuffer();

        // Send response
        const filename = `Salary_${user.employee_id}_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);

    } catch (error) {
        console.error('Error exporting salary:', error);
        res.status(500).json({ error: 'Failed to export salary history' });
    }
});

// ==================== PARAMETERIZED ROUTES ====================
// These MUST come AFTER specific routes

/**
 * GET /api/salary/:userId
 * Get salary history for an employee
 * Users can view their own, admins can view any
 */
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const requesterId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        // Check permission
        if (!isAdmin && parseInt(userId) !== requesterId) {
            return res.status(403).json({ error: 'You can only view your own salary history' });
        }

        // Get salary payments (encrypted)
        const payments = await pool.query(
            `SELECT sp.id, sp.user_id, sp.encrypted_amount, sp.payment_date, 
                    sp.payment_type, sp.payment_month, sp.notes, sp.created_at, sp.updated_at,
                    u.full_name as created_by_name
             FROM salary_payments sp
             LEFT JOIN users u ON sp.created_by = u.id
             WHERE sp.user_id = $1
             ORDER BY sp.payment_date DESC`,
            [userId]
        );

        // Decrypt amounts for authorized user
        const decryptedPayments = decryptPayments(payments.rows);

        // Calculate summary from decrypted data
        let totalAmount = 0;
        let totalSalary = 0;
        let totalBonus = 0;
        let totalReimbursements = 0;

        decryptedPayments.forEach(p => {
            const amt = p.amount || 0;
            totalAmount += amt;
            if (p.payment_type === 'salary') totalSalary += amt;
            if (p.payment_type === 'bonus') totalBonus += amt;
            if (p.payment_type === 'reimbursement') totalReimbursements += amt;
        });

        // Get user info
        const userInfo = await pool.query(
            'SELECT full_name, employee_id, department, joining_date FROM users WHERE id = $1',
            [userId]
        );

        const summary = userInfo.rows[0] ? {
            ...userInfo.rows[0],
            total_payments: decryptedPayments.length,
            total_amount_paid: totalAmount,
            total_salary: totalSalary,
            total_bonus: totalBonus,
            total_reimbursements: totalReimbursements
        } : null;

        // Build monthly breakdown from decrypted data
        const monthlyMap = {};
        decryptedPayments.forEach(p => {
            const month = p.payment_month || 'unknown';
            if (!monthlyMap[month]) {
                monthlyMap[month] = { payment_month: month, salary: 0, bonus: 0, reimbursement: 0, other: 0, month_total: 0 };
            }
            const amt = p.amount || 0;
            monthlyMap[month].month_total += amt;
            if (['salary', 'bonus', 'reimbursement'].includes(p.payment_type)) {
                monthlyMap[month][p.payment_type] += amt;
            } else {
                monthlyMap[month].other += amt;
            }
        });

        const monthly = Object.values(monthlyMap).sort((a, b) =>
            b.payment_month.localeCompare(a.payment_month)
        ).slice(0, 24);

        res.json({
            payments: decryptedPayments,
            summary,
            monthly
        });

    } catch (error) {
        console.error('Error fetching salary history:', error);
        res.status(500).json({ error: 'Failed to fetch salary history' });
    }
});

/**
 * POST /api/salary/:userId
 * Add a payment record (admin only)
 * Amount is encrypted before storage
 */
router.post('/:userId', requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { amount, payment_date, payment_type, payment_month, notes } = req.body;
        const createdBy = req.user.id;

        // Check encryption is configured
        if (!isEncryptionConfigured()) {
            return res.status(500).json({
                error: 'Encryption not configured. Set SALARY_ENCRYPTION_KEY in environment.'
            });
        }

        // Validate
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Valid amount is required' });
        }
        if (!payment_date) {
            return res.status(400).json({ error: 'Payment date is required' });
        }

        // Check if user exists
        const userCheck = await pool.query(
            'SELECT id, full_name FROM users WHERE id = $1',
            [userId]
        );
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Encrypt the amount before storing
        const encryptedAmount = encryptAmount(amount);

        // Insert payment with encrypted amount
        const result = await pool.query(
            `INSERT INTO salary_payments 
             (user_id, encrypted_amount, payment_date, payment_type, payment_month, notes, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, user_id, payment_date, payment_type, payment_month, notes, created_at`,
            [userId, encryptedAmount, payment_date, payment_type || 'salary', payment_month, notes, createdBy]
        );

        // Log activity (with amount shown to admin in log)
        await pool.query(
            'INSERT INTO activity_log (user_id, action_type, action_details) VALUES ($1, $2, $3)',
            [createdBy, 'salary_payment_added', `Added payment for ${userCheck.rows[0].full_name}`]
        );

        console.log(`💰 Salary payment added for ${userCheck.rows[0].full_name} (encrypted)`);

        res.status(201).json({
            message: 'Payment recorded successfully',
            payment: {
                ...result.rows[0],
                amount // Return the original amount to the admin
            }
        });

    } catch (error) {
        console.error('Error adding salary payment:', error);
        res.status(500).json({ error: 'Failed to add payment' });
    }
});

export default router;
