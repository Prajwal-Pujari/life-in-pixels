// Excel Export API Routes
// Handles all export-related endpoints

import { generateIndividualReport } from './individual-report.js';

// Export individual employee report
export async function exportIndividualReport(req, res, pool) {
    try {
        const { userId, startDate, endDate } = req.body;

        if (!userId || !startDate || !endDate) {
            return res.status(400).json({
                error: 'Missing required fields: userId, startDate, endDate'
            });
        }

        // Validate date range (max 1 year)
        const start = new Date(startDate);
        const end = new Date(endDate);
        const daysDiff = (end - start) / (1000 * 60 * 60 * 24);

        if (daysDiff > 365) {
            return res.status(400).json({
                error: 'Date range cannot exceed 1 year'
            });
        }

        // Get employee details
        const employeeResult = await pool.query(
            `SELECT id, full_name, employee_id, department, email, created_at
             FROM users
             WHERE id = $1`,
            [userId]
        );

        if (employeeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        const employee = employeeResult.rows[0];

        // Get attendance data
        const attendanceResult = await pool.query(
            `SELECT date, status, work_hours_start, work_hours_end, notes
             FROM attendance
             WHERE user_id = $1 AND date BETWEEN $2 AND $3
             ORDER BY date ASC`,
            [userId, startDate, endDate]
        );

        // Generate all dates in range (including days without attendance)
        const allDates = [];
        const current = new Date(startDate);
        const endD = new Date(endDate);

        while (current <= endD) {
            const dateStr = current.toISOString().split('T')[0];
            const attendanceRecord = attendanceResult.rows.find(r =>
                r.date.toISOString().split('T')[0] === dateStr
            );

            allDates.push({
                date: dateStr,
                status: attendanceRecord?.status || null,
                work_hours_start: attendanceRecord?.work_hours_start || null,
                work_hours_end: attendanceRecord?.work_hours_end || null,
                notes: attendanceRecord?.notes || null
            });

            current.setDate(current.getDate() + 1);
        }

        // Generate Excel report
        const { buffer, filename } = await generateIndividualReport(
            employee,
            allDates,
            { startDate, endDate }
        );

        // Log activity
        await pool.query(
            'INSERT INTO activity_log (user_id, action_type, action_details) VALUES ($1, $2, $3)',
            [req.user.id, 'export_report', `Exported individual report for ${employee.full_name}`]
        );

        // Send file
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);

    } catch (error) {
        console.error('❌ Error exporting individual report:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
}


import { generateBulkReport } from './bulk-report.js';
import { generateMonthlySummary } from './monthly-summary.js';

// Export bulk report (all employees)
export async function exportBulkReport(req, res, pool) {
    try {
        const { startDate, endDate } = req.body;

        if (!startDate || !endDate) {
            return res.status(400).json({
                error: 'Missing required fields: startDate, endDate'
            });
        }

        // Validate date range (max 1 year)
        const start = new Date(startDate);
        const end = new Date(endDate);
        const daysDiff = (end - start) / (1000 * 60 * 60 * 24);

        if (daysDiff > 365) {
            return res.status(400).json({
                error: 'Date range cannot exceed 1 year'
            });
        }

        // Generate bulk report
        const { buffer, filename } = await generateBulkReport(pool, { startDate, endDate });

        // Log activity
        await pool.query(
            'INSERT INTO activity_log (user_id, action_type, action_details) VALUES ($1, $2, $3)',
            [req.user.id, 'export_report', `Exported bulk report for all employees`]
        );

        // Send file
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);

    } catch (error) {
        console.error('❌ Error exporting bulk report:', error);
        res.status(500).json({ error: 'Failed to generate bulk report' });
    }
}

// Export monthly summary
export async function exportMonthlySummary(req, res, pool) {
    try {
        const { year, month } = req.body;

        if (!year || !month) {
            return res.status(400).json({
                error: 'Missing required fields: year, month'
            });
        }

        // Validate year and month
        const yearNum = parseInt(year);
        const monthNum = parseInt(month);

        if (yearNum < 2020 || yearNum > 2100 || monthNum < 1 || monthNum > 12) {
            return res.status(400).json({
                error: 'Invalid year or month'
            });
        }

        // Generate monthly summary
        const { buffer, filename } = await generateMonthlySummary(pool, yearNum, monthNum);

        // Log activity
        await pool.query(
            'INSERT INTO activity_log (user_id, action_type, action_details) VALUES ($1, $2, $3)',
            [req.user.id, 'export_report', `Exported monthly summary for ${year}-${month}`]
        );

        // Send file
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);

    } catch (error) {
        console.error('❌ Error exporting monthly summary:', error);
        res.status(500).json({ error: 'Failed to generate monthly summary' });
    }
}

// TODO: Export statistics report
export async function exportStatisticsReport(req, res, pool) {
    res.status(501).json({ error: 'Not implemented yet' });
}

// TODO: Export payroll report
export async function exportPayrollReport(req, res, pool) {
    res.status(501).json({ error: 'Not implemented yet' });
}

// TODO: Export custom report
export async function exportCustomReport(req, res, pool) {
    res.status(501).json({ error: 'Not implemented yet' });
}

