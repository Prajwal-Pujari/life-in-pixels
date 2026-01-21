// User Approval API Routes
import express from 'express';

// Middleware to check if user is approved
export function isApproved(req, res, next) {
    if (!req.user.is_approved) {
        return res.status(403).json({
            error: 'Your account is pending admin approval',
            pending: true,
            user: {
                full_name: req.user.full_name,
                email: req.user.email,
                employee_id: req.user.employee_id
            }
        });
    }
    next();
}

// Get pending users (admin only)
export async function getPendingUsers(req, res, pool) {
    try {
        const result = await pool.query(
            `SELECT id, full_name, username, email, google_email, employee_id, avatar_url, created_at 
             FROM users 
             WHERE is_approved = false 
             ORDER BY created_at DESC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('❌ Error fetching pending users:', error);
        res.status(500).json({ error: 'Failed to fetch pending users' });
    }
}

// Approve user and assign role (admin only)
export async function approveUser(req, res, pool) {
    try {
        const { userId, role } = req.body;

        if (!userId || !role) {
            return res.status(400).json({ error: 'User ID and role are required' });
        }

        if (role !== 'admin' && role !== 'employee') {
            return res.status(400).json({ error: 'Role must be either admin or employee' });
        }

        const result = await pool.query(
            `UPDATE users 
             SET is_approved = true, role = $1 
             WHERE id = $2 
             RETURNING full_name, email, employee_id`,
            [role, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Log activity
        await pool.query(
            'INSERT INTO activity_log (user_id, action_type, action_details) VALUES ($1, $2, $3)',
            [req.user.id, 'approve_user', `Approved ${result.rows[0].full_name} as ${role}`]
        );

        console.log(`✅ User approved: ${result.rows[0].full_name} (${result.rows[0].employee_id}) as ${role}`);
        res.json({
            success: true,
            user: result.rows[0],
            message: `User approved as ${role}`
        });
    } catch (error) {
        console.error('❌ Error approving user:', error);
        res.status(500).json({ error: 'Failed to approve user' });
    }
}

// Reject user (delete from database) - admin only
export async function rejectUser(req, res, pool) {
    try {
        const { id } = req.params;

        const user = await pool.query(
            'SELECT full_name, email FROM users WHERE id = $1',
            [id]
        );

        if (user.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        await pool.query('DELETE FROM users WHERE id = $1', [id]);

        // Log activity
        await pool.query(
            'INSERT INTO activity_log (user_id, action_type, action_details) VALUES ($1, $2, $3)',
            [req.user.id, 'reject_user', `Rejected user: ${user.rows[0].full_name}`]
        );

        console.log(`❌ User rejected and deleted: ${user.rows[0].full_name}`);
        res.json({
            success: true,
            message: 'User rejected and removed'
        });
    } catch (error) {
        console.error('❌ Error rejecting user:', error);
        res.status(500).json({ error: 'Failed to reject user' });
    }
}
