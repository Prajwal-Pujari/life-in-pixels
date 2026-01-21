// Telegram Attendance Report Handler
import { generateAttendanceReport, sendTelegramMessage } from './telegram-bot.js';

// Send daily attendance report to Telegram
export async function sendDailyAttendanceReport(req, res, pool) {
    try {
        const requestedDate = req.body?.date || req.query?.date;
        const date = requestedDate || new Date().toISOString().split('T')[0];

        // Query attendance data with employee details
        const query = `
            SELECT 
                u.id,
                u.full_name,
                u.employee_id,
                u.department,
                a.status,
                a.work_hours_start,
                a.work_hours_end,
                a.notes,
                a.date
            FROM users u
            LEFT JOIN attendance a ON u.id = a.user_id AND a.date = $1
            WHERE u.is_active = true AND u.is_approved = true AND u.role IS NOT NULL
            ORDER BY 
                CASE 
                    WHEN a.status = 'present' THEN 1
                    WHEN a.status = 'wfh' THEN 2
                    WHEN a.status = 'half_day' THEN 3
                    WHEN a.status = 'on_leave' THEN 4
                    WHEN a.status = 'leave' THEN 4
                    WHEN a.status = 'absent' THEN 5
                    ELSE 6
                END,
                u.full_name
        `;

        const result = await pool.query(query, [date]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'No employees found',
                message: 'There are no active employees in the system'
            });
        }

        // Generate report
        const { message, stats } = generateAttendanceReport(result.rows, date);

        // Send to Telegram
        await sendTelegramMessage(message);

        // Log activity
        await pool.query(
            'INSERT INTO activity_log (user_id, action_type, action_details) VALUES ($1, $2, $3)',
            [req.user.id, 'telegram_report', `Sent attendance report for ${date}`]
        );

        console.log(`✅ Attendance report sent to Telegram for ${date}`);

        res.json({
            success: true,
            message: 'Report sent to Telegram successfully',
            date: date,
            stats: stats
        });

    } catch (error) {
        console.error('❌ Error sending Telegram report:', error);

        // More specific error messages
        let errorMessage = 'Failed to send report to Telegram';
        if (error.message.includes('not initialized')) {
            errorMessage = 'Telegram bot is not configured. Please set TELEGRAM_BOT_TOKEN in .env';
        } else if (error.message.includes('CHAT_ID')) {
            errorMessage = 'Telegram chat ID is not configured. Please set TELEGRAM_CHAT_ID in .env';
        } else if (error.message.includes('Forbidden')) {
            errorMessage = 'Bot does not have permission to send messages. Make sure the bot is added to the chat/channel';
        } else if (error.message.includes('Bad Request')) {
            errorMessage = 'Invalid chat ID or bot token. Please check your Telegram configuration';
        }

        res.status(500).json({
            error: errorMessage,
            details: error.message
        });
    }
}

// Get report preview without sending
export async function getAttendanceReportPreview(req, res, pool) {
    try {
        const date = req.query.date || new Date().toISOString().split('T')[0];

        const query = `
            SELECT 
                u.id,
                u.full_name,
                u.employee_id,
                u.department,
                a.status,
                a.work_hours_start,
                a.work_hours_end,
                a.notes,
                a.date
            FROM users u
            LEFT JOIN attendance a ON u.id = a.user_id AND a.date = $1
            WHERE u.is_active = true AND u.is_approved = true AND u.role IS NOT NULL
            ORDER BY 
                CASE 
                    WHEN a.status = 'present' THEN 1
                    WHEN a.status = 'wfh' THEN 2
                    WHEN a.status = 'half_day' THEN 3
                    WHEN a.status = 'on_leave' THEN 4
                    WHEN a.status = 'leave' THEN 4
                    WHEN a.status = 'absent' THEN 5
                    ELSE 6
                END,
                u.full_name
        `;

        const result = await pool.query(query, [date]);

        const { message, stats } = generateAttendanceReport(result.rows, date);

        res.json({
            success: true,
            date: date,
            stats: stats,
            preview: message,
            employeeCount: result.rows.length
        });

    } catch (error) {
        console.error('❌ Error generating report preview:', error);
        res.status(500).json({ error: 'Failed to generate report preview' });
    }
}
