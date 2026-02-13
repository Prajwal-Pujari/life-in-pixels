// Interactive Telegram Bot Commands
import { bot } from './telegram-bot.js';
import {
    showExportMenu,
    exportToday,
    exportWeek,
    exportMonth,
    handleCallbackQuery as handleExportCallback
} from './telegram-export-handlers.js';
import { generateIndividualReport } from './exports/individual-report.js';
import { generateBulkReport } from './exports/bulk-report.js';
import { generateMonthlySummary } from './exports/monthly-summary.js';
// User commands (verification, check-in/out, expenses, leave)
import {
    setUserCommandsDbPool,
    handleVerifyCommand,
    handleCodeCommand,
    handleCheckinCommand,
    handleCheckoutCommand,
    handleMyStatusCommand,
    handleExpenseCommand,
    handleExpensesCommand,
    handleSubmitCommand,
    handleLeaveCommand,
    handleMyLeavesCommand,
    handleUserHelpCommand
} from './telegram-user-commands.js';

let dbPool = null;

// User state management for multi-step flows
const userStates = new Map();

// Initialize with database pool
export async function initializeTelegramCommands(pool) {
    dbPool = pool;
    // Also set dbPool for export handlers (synchronously)
    const exportHandlers = await import('./telegram-export-handlers.js');
    if (exportHandlers.setDbPool) {
        exportHandlers.setDbPool(pool);
        console.log('✅ Database pool set for export handlers');
    }
    // Set dbPool for user commands
    setUserCommandsDbPool(pool);
    console.log('✅ Database pool set for user commands');
}

// Set up command handlers
export function setupCommandHandlers(botInstance) {
    if (!botInstance) return;

    // Remove all existing listeners to prevent duplicates on hot reload
    botInstance.removeAllListeners();

    // /start command
    botInstance.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        console.log(`📱 Received /start command from user ${msg.from.id} (${msg.from.username || msg.from.first_name})`);
        const welcomeMessage = `
🎯 <b>Life In Pixels - Work Tracker Bot</b>

<b>🔐 First Time? Link Your Account:</b>
/verify [email] - Verify with your work email

<b>⏰ Attendance:</b>
/checkin - Mark entry time
/checkout - Mark exit time
/mystatus - View today's status

<b>💰 Expenses (Calibration):</b>
/expense Type - Amount - Add expense
/expenses - View today's expenses
/submit - Submit for approval

<b>🌴 Leave:</b>
/leave START END Reason - Request leave
/myleaves - Check leave status

<b>📊 Reports:</b>
/summary - Today's attendance
/present - Present employees
/export - Excel reports (Admin)

/help - Show detailed help

<i>Powered by Life In Pixels</i>
        `;
        botInstance.sendMessage(chatId, welcomeMessage, { parse_mode: 'HTML' });
    });

    // /help command - Now shows personalized help
    botInstance.onText(/\/help/, (msg) => handleUserHelpCommand(msg, botInstance));

    // ==================== USER COMMANDS ====================

    // Email verification commands
    botInstance.onText(/\/verify/, (msg) => handleVerifyCommand(msg, botInstance));
    botInstance.onText(/\/code/, (msg) => handleCodeCommand(msg, botInstance));

    // Attendance commands
    botInstance.onText(/\/checkin/, (msg) => handleCheckinCommand(msg, botInstance));
    botInstance.onText(/\/checkout/, (msg) => handleCheckoutCommand(msg, botInstance));
    botInstance.onText(/\/mystatus/, (msg) => handleMyStatusCommand(msg, botInstance));

    // Expense commands (Calibration only)
    botInstance.onText(/\/expense(?!s)/, (msg) => handleExpenseCommand(msg, botInstance));
    botInstance.onText(/\/expenses/, (msg) => handleExpensesCommand(msg, botInstance));
    botInstance.onText(/\/submit/, (msg) => handleSubmitCommand(msg, botInstance));

    // Leave request commands
    botInstance.onText(/\/leave/, (msg) => handleLeaveCommand(msg, botInstance));
    botInstance.onText(/\/myleaves/, (msg) => handleMyLeavesCommand(msg, botInstance));

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
            console.log(`📱 Received plain text from user ${msg.from.id}: "${text}"`);

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

    // /export command - Main export menu
    botInstance.onText(/\/export$/, async (msg) => {
        const chatId = msg.chat.id;
        console.log(`📱 Received /export command from user ${msg.from.id} (${msg.from.username || msg.from.first_name})`);
        await showExportMenu(chatId, botInstance, msg.from.id);
    });

    // Quick export commands
    botInstance.onText(/\/export_today/, async (msg) => {
        const chatId = msg.chat.id;
        await exportToday(chatId, botInstance, msg.from.id);
    });

    botInstance.onText(/\/export_week/, async (msg) => {
        const chatId = msg.chat.id;
        await exportWeek(chatId, botInstance, msg.from.id);
    });

    botInstance.onText(/\/export_month/, async (msg) => {
        const chatId = msg.chat.id;
        await exportMonth(chatId, botInstance, msg.from.id);
    });

    // Handle callback queries (button clicks)
    botInstance.on('callback_query', async (query) => {
        const data = query.data;
        console.log(`📱 Received callback query from user ${query.from.id}: data="${data}"`);

        // Only handle export-related callbacks
        if (data && (data.startsWith('export_') || data.startsWith('employee_') ||
            data.startsWith('range_') || data.startsWith('month_'))) {
            console.log(`✅ Processing export callback: ${data}`);
            await handleExportCallback(query, botInstance);
        } else {
            console.log(`⚠️ Ignoring non-export callback: ${data}`);
            // Acknowledge other callbacks but don't process them
            botInstance.answerCallbackQuery(query.id);
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
