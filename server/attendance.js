// Attendance API Routes
import { sendAttendanceNotification } from './telegram-notifications.js';
import express from 'express';

// Permission middleware - employees can only mark today, admins can edit any date
export function canMarkAttendance(req, res, next) {
    const { attendance_date } = req.body;
    const user = req.user;

    // Admins can always mark/edit attendance
    if (user.role === 'admin') {
        return next();
    }

    // Employees can only mark today's attendance
    const today = new Date().toISOString().split('T')[0];
    const requestedDate = new Date(attendance_date).toISOString().split('T')[0];

    if (requestedDate !== today) {
        return res.status(403).json({
            error: 'Employees can only mark attendance for today. Please contact admin to edit past dates.'
        });
    }

    next();
}

// Get attendance records
// Employees see their own, admins can see anyone's
export async function getAttendance(req, res, pool) {
    try {
        const userId = req.query.userId || req.user.id;
        const month = req.query.month; // YYYY-MM format
        const year = req.query.year;

        // Non-admins can only view their own attendance
        if (req.user.role !== 'admin' && parseInt(userId) !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        let query = 'SELECT * FROM attendance WHERE user_id = $1';
        const params = [userId];

        if (month) {
            query += ' AND DATE_TRUNC(\'month\', date) = $2::date';
            params.push(`${month}-01`);
        } else if (year) {
            query += ' AND EXTRACT(YEAR FROM date) = $2';
            params.push(year);
        }

        query += ' ORDER BY date DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('❌ Error fetching attendance:', error);
        res.status(500).json({ error: 'Failed to fetch attendance' });
    }
}

// Mark attendance
export async function markAttendance(req, res, pool) {
    try {
        const {
            userId,
            attendance_date,
            status,
            check_in_time,
            check_out_time,
            notes
        } = req.body;

        // Determine which user's attendance to mark
        const targetUserId = req.user.role === 'admin' && userId ? userId : req.user.id;
        const markedByAdmin = req.user.role === 'admin' && userId && userId !== req.user.id;

        // Validate required fields
        if (!attendance_date || !status) {
            return res.status(400).json({ error: 'Attendance date and status are required' });
        }

        // Check if attendance already exists
        const existing = await pool.query(
            'SELECT id FROM attendance WHERE user_id = $1 AND date = $2',
            [targetUserId, attendance_date]
        );

        if (existing.rows.length > 0) {
            // Update existing attendance
            const result = await pool.query(
                `UPDATE attendance 
                 SET status = $1, work_hours_start = $2, work_hours_end = $3, notes = $4
                 WHERE user_id = $5 AND date = $6
                 RETURNING *`,
                [status, check_in_time, check_out_time, notes, targetUserId, attendance_date]
            );

            // Log activity
            await pool.query(
                'INSERT INTO activity_log (user_id, action_type, action_details) VALUES ($1, $2, $3)',
                [req.user.id, 'update_attendance', `Updated attendance for ${attendance_date}`]
            );

            return res.json(result.rows[0]);
        } else {
            // Create new attendance record
            const result = await pool.query(
                `INSERT INTO attendance 
                 (user_id, date, status, work_hours_start, work_hours_end, notes, marked_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW())
                 RETURNING *`,
                [targetUserId, attendance_date, status, check_in_time, check_out_time, notes]
            );

            // Log activity
            await pool.query(
                'INSERT INTO activity_log (user_id, action_type, action_details) VALUES ($1, $2, $3)',
                [req.user.id, 'mark_attendance', `Marked attendance for ${attendance_date}`]
            );

            console.log(`✅ Attendance marked: ${req.user.username} - ${attendance_date} - ${status}`);

            // Get full user details for Telegram notification
            const userDetails = await pool.query(
                'SELECT full_name, employee_id, department FROM users WHERE id = $1',
                [targetUserId]
            );

            // Send Telegram notification in background (non-blocking)
            if (userDetails.rows.length > 0) {
                sendAttendanceNotification(
                    userDetails.rows[0],
                    {
                        status,
                        date: attendance_date,
                        work_hours_start: check_in_time,
                        work_hours_end: check_out_time,
                        notes
                    }
                ).catch(err => console.log('⚠️ Telegram notification failed:', err.message));
            }

            res.status(201).json(result.rows[0]);
        }
    } catch (error) {
        console.error('❌ Error marking attendance:', error);
        res.status(500).json({ error: 'Failed to mark attendance' });
    }
}

// Delete attendance (admin only)
export async function deleteAttendance(req, res, pool) {
    try {
        const { id } = req.params;

        // Only admins can delete
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can delete attendance records' });
        }

        await pool.query('DELETE FROM attendance WHERE id = $1', [id]);

        // Log activity
        await pool.query(
            'INSERT INTO activity_log (user_id, action_type, action_details) VALUES ($1, $2, $3)',
            [req.user.id, 'delete_attendance', `Deleted attendance record ${id}`]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error deleting attendance:', error);
        res.status(500).json({ error: 'Failed to delete attendance' });
    }
}

// Get attendance summary for a user
export async function getAttendanceSummary(req, res, pool) {
    try {
        const userId = req.query.userId || req.user.id;
        const month = req.query.month; // YYYY-MM

        // Non-admins can only view their own summary
        if (req.user.role !== 'admin' && parseInt(userId) !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const result = await pool.query(
            `SELECT * FROM attendance_summary 
             WHERE user_id = $1 AND month = $2::date`,
            [userId, `${month}-01`]
        );

        res.json(result.rows[0] || {});
    } catch (error) {
        console.error('❌ Error fetching attendance summary:', error);
        res.status(500).json({ error: 'Failed to fetch summary' });
    }
}
