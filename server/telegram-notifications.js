// Real-time Telegram Notifications for Attendance
import { sendTelegramMessage } from './telegram-bot.js';

// Format time for display
function formatTime(timeString) {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

// Get status emoji
function getStatusEmoji(status) {
    const statusMap = {
        'present': '✅',
        'absent': '❌',
        'wfh': '🏠',
        'half_day': '⏰',
        'on_leave': '🌴',
        'leave': '🌴'
    };
    return statusMap[status] || '❓';
}

// Send notification when user marks attendance
export async function sendAttendanceNotification(userData, attendanceData) {
    try {
        const enabled = process.env.TELEGRAM_ENABLED === 'true';
        if (!enabled) {
            return; // Silently skip if disabled
        }

        const emoji = getStatusEmoji(attendanceData.status);
        const statusLabel = attendanceData.status.toUpperCase().replace('_', ' ');

        let message = `🔔 <b>ATTENDANCE MARKED</b>\n\n`;
        message += `${emoji} <b>${statusLabel}</b>\n`;
        message += `━━━━━━━━━━━━━━━━━━\n`;
        message += `👤 ${userData.full_name}\n`;
        message += `🆔 ${userData.employee_id}\n`;

        if (userData.department) {
            message += `🏢 ${userData.department}\n`;
        }

        message += `📅 ${new Date(attendanceData.date).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        })}\n`;

        // Add work hours if present
        if (attendanceData.work_hours_start && attendanceData.work_hours_end) {
            message += `\n⏰ <b>Work Hours:</b>\n`;
            message += `   ${formatTime(attendanceData.work_hours_start)} → ${formatTime(attendanceData.work_hours_end)}\n`;
        }

        // Add notes if present
        if (attendanceData.notes && attendanceData.notes.trim()) {
            const truncatedNotes = attendanceData.notes.length > 150
                ? attendanceData.notes.substring(0, 147) + '...'
                : attendanceData.notes;
            message += `\n📝 <b>Note:</b>\n${truncatedNotes}\n`;
        }

        // Footer
        const timestamp = new Date().toLocaleString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        message += `\n<i>Marked at ${timestamp}</i>`;

        await sendTelegramMessage(message);
        console.log(`📱 Telegram notification sent for ${userData.full_name}`);
    } catch (error) {
        // Don't throw error - just log it
        console.error('⚠️ Failed to send Telegram notification:', error.message);
    }
}

// Send daily summary at end of day
export async function sendDailySummary(pool) {
    try {
        const enabled = process.env.TELEGRAM_ENABLED === 'true';
        if (!enabled) return;

        const today = new Date().toISOString().split('T')[0];

        const result = await pool.query(
            `SELECT COUNT(*) as total,
                    SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
                    SUM(CASE WHEN status = 'wfh' THEN 1 ELSE 0 END) as wfh,
                    SUM(CASE WHEN status = 'half_day' THEN 1 ELSE 0 END) as half_day
             FROM attendance
             WHERE date = $1`,
            [today]
        );

        const stats = result.rows[0];

        let message = `📊 <b>QUICK SUMMARY - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</b>\n\n`;
        message += `✅ Present: ${stats.present}\n`;
        message += `🏠 WFH: ${stats.wfh}\n`;
        message += `⏰ Half Day: ${stats.half_day}\n`;
        message += `━━━━━━━━━━━━━━━━━━\n`;
        message += `Total: ${stats.total} marked`;

        await sendTelegramMessage(message);
    } catch (error) {
        console.error('⚠️ Failed to send daily summary:', error.message);
    }
}
