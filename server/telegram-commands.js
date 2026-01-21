// Interactive Telegram Bot Commands
import { bot } from './telegram-bot.js';

let dbPool = null;

// Initialize with database pool
export function initializeTelegramCommands(pool) {
    dbPool = pool;
}

// Set up command handlers
export function setupCommandHandlers(botInstance) {
    if (!botInstance) return;

    // /start command
    botInstance.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        const welcomeMessage = `
🎯 <b>Life In Pixels - Work Tracker Bot</b>

Available Commands:
━━━━━━━━━━━━━━━━━━
📊 /summary or /today - Today's attendance summary
👥 /present - List of present employees
🏠 /wfh - Work from home employees
📈 /stats - Quick statistics
ℹ️ /help - Show this help message

You can also just type:
• "summary" - Get today's summary
• "stats" - Get quick stats
• "present" - See who's present

<i>Powered by Life In Pixels</i>
        `;
        botInstance.sendMessage(chatId, welcomeMessage, { parse_mode: 'HTML' });
    });

    // /help command
    botInstance.onText(/\/help/, (msg) => {
        const chatId = msg.chat.id;
        botInstance.sendMessage(chatId, 'Type /start to see available commands', { parse_mode: 'HTML' });
    });

    // /summary or /today command
    botInstance.onText(/\/(summary|today)/, async (msg) => {
        const chatId = msg.chat.id;
        await sendQuickSummary(chatId, botInstance);
    });

    // /present command
    botInstance.onText(/\/present/, async (msg) => {
        const chatId = msg.chat.id;
        await sendPresentList(chatId, botInstance);
    });

    // /wfh command
    botInstance.onText(/\/wfh/, async (msg) => {
        const chatId = msg.chat.id;
        await sendWFHList(chatId, botInstance);
    });

    // /stats command
    botInstance.onText(/\/stats/, async (msg) => {
        const chatId = msg.chat.id;
        await sendQuickStats(chatId, botInstance);
    });

    // Handle plain text messages (without /)
    botInstance.on('message', async (msg) => {
        if (msg.text && !msg.text.startsWith('/')) {
            const chatId = msg.chat.id;
            const text = msg.text.toLowerCase().trim();

            if (text === 'summary' || text === 'today') {
                await sendQuickSummary(chatId, botInstance);
            } else if (text === 'present') {
                await sendPresentList(chatId, botInstance);
            } else if (text === 'wfh') {
                await sendWFHList(chatId, botInstance);
            } else if (text === 'stats') {
                await sendQuickStats(chatId, botInstance);
            }
        }
    });

    console.log('✅ Telegram command handlers registered');
}

// Send quick summary
async function sendQuickSummary(chatId, botInstance) {
    if (!dbPool) {
        botInstance.sendMessage(chatId, '❌ Database not available');
        return;
    }

    try {
        const today = new Date().toISOString().split('T')[0];

        const result = await dbPool.query(
            `SELECT 
                COUNT(*) FILTER (WHERE status = 'present') as present,
                COUNT(*) FILTER (WHERE status = 'wfh') as wfh,
                COUNT(*) FILTER (WHERE status = 'half_day') as half_day,
                COUNT(*) FILTER (WHERE status = 'on_leave' OR status = 'leave') as on_leave,
                COUNT(*) FILTER (WHERE status = 'absent') as absent,
                COUNT(*) as total_marked
             FROM attendance
             WHERE date = $1`,
            [today]
        );

        const totalUsers = await dbPool.query(
            'SELECT COUNT(*) as total FROM users WHERE is_active = true AND is_approved = true AND role IS NOT NULL'
        );

        const stats = result.rows[0];
        const total = parseInt(totalUsers.rows[0].total);
        const notMarked = total - parseInt(stats.total_marked);

        let message = `📊 <b>QUICK SUMMARY - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</b>\n\n`;

        if (stats.present > 0) message += `✅ Present: ${stats.present}\n`;
        if (stats.wfh > 0) message += `🏠 WFH: ${stats.wfh}\n`;
        if (stats.half_day > 0) message += `⏰ Half Day: ${stats.half_day}\n`;
        if (stats.on_leave > 0) message += `🌴 On Leave: ${stats.on_leave}\n`;
        if (stats.absent > 0) message += `❌ Absent: ${stats.absent}\n`;
        if (notMarked > 0) message += `⚠️ Not Marked: ${notMarked}\n`;

        message += `━━━━━━━━━━━━━━━━━━\n`;
        message += `Total: ${total} employees\n\n`;
        message += `<i>Type /present to see who's in office</i>`;

        botInstance.sendMessage(chatId, message, { parse_mode: 'HTML' });
    } catch (error) {
        console.error('Error sending summary:', error);
        botInstance.sendMessage(chatId, '❌ Failed to fetch summary');
    }
}

// Send present employees list
async function sendPresentList(chatId, botInstance) {
    if (!dbPool) {
        botInstance.sendMessage(chatId, '❌ Database not available');
        return;
    }

    try {
        const today = new Date().toISOString().split('T')[0];

        const result = await dbPool.query(
            `SELECT u.full_name, u.employee_id, u.department, a.work_hours_start, a.work_hours_end
             FROM users u
             JOIN attendance a ON u.id = a.user_id
             WHERE a.date = $1 AND a.status = 'present'
             ORDER BY u.full_name`,
            [today]
        );

        if (result.rows.length === 0) {
            botInstance.sendMessage(chatId, '😔 No one marked present yet today');
            return;
        }

        let message = `✅ <b>PRESENT TODAY (${result.rows.length})</b>\n\n`;

        result.rows.forEach((emp, index) => {
            message += `${index + 1}. ${emp.full_name} (${emp.employee_id})\n`;
            if (emp.department) {
                message += `   🏢 ${emp.department}\n`;
            }
            if (emp.work_hours_start && emp.work_hours_end) {
                message += `   ⏰ ${formatTime(emp.work_hours_start)} - ${formatTime(emp.work_hours_end)}\n`;
            }
            message += `\n`;
        });

        botInstance.sendMessage(chatId, message, { parse_mode: 'HTML' });
    } catch (error) {
        console.error('Error sending present list:', error);
        botInstance.sendMessage(chatId, '❌ Failed to fetch present list');
    }
}

// Send WFH employees list
async function sendWFHList(chatId, botInstance) {
    if (!dbPool) {
        botInstance.sendMessage(chatId, '❌ Database not available');
        return;
    }

    try {
        const today = new Date().toISOString().split('T')[0];

        const result = await dbPool.query(
            `SELECT u.full_name, u.employee_id, u.department
             FROM users u
             JOIN attendance a ON u.id = a.user_id
             WHERE a.date = $1 AND a.status = 'wfh'
             ORDER BY u.full_name`,
            [today]
        );

        if (result.rows.length === 0) {
            botInstance.sendMessage(chatId, 'No one working from home today');
            return;
        }

        let message = `🏠 <b>WORK FROM HOME (${result.rows.length})</b>\n\n`;

        result.rows.forEach((emp, index) => {
            message += `${index + 1}. ${emp.full_name} (${emp.employee_id})\n`;
            if (emp.department) {
                message += `   🏢 ${emp.department}\n`;
            }
        });

        botInstance.sendMessage(chatId, message, { parse_mode: 'HTML' });
    } catch (error) {
        console.error('Error sending WFH list:', error);
        botInstance.sendMessage(chatId, '❌ Failed to fetch WFH list');
    }
}

// Send quick stats
async function sendQuickStats(chatId, botInstance) {
    await sendQuickSummary(chatId, botInstance);
}

// Helper function to format time
function formatTime(timeString) {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}
