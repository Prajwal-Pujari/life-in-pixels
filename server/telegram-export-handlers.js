// Export helper functions
import { generateIndividualReport } from './exports/individual-report.js';
import { generateBulkReport } from './exports/bulk-report.js';
import { generateMonthlySummary } from './exports/monthly-summary.js';

let dbPool = null;

// User state management for multi-step flows
const userStates = new Map();

// Set database pool from main module
export function setDbPool(pool) {
    dbPool = pool;
}

// Export  functions for use in telegram-commands.js
export {
    showExportMenu,
    exportToday,
    exportWeek,
    exportMonth,
    handleCallbackQuery
};

// Show export menu with inline keyboard
async function showExportMenu(chatId, botInstance, userId) {
    console.log(`📥 Export menu requested by user ${userId} in chat ${chatId}`);

    const adminStatus = await isAdmin(userId);
    if (!adminStatus) {
        console.log(`❌ User ${userId} is not an admin - denying export access`);
        botInstance.sendMessage(chatId, '❌ This command is only available for admins');
        return;
    }

    console.log(`✅ User ${userId} is admin - showing export menu`);

    const keyboard = {
        inline_keyboard: [
            [{ text: '\ud83d\udc64 Individual Report', callback_data: 'export_individual' }],
            [{ text: '\ud83d\udc65 Bulk Report (All Employees)', callback_data: 'export_bulk' }],
            [{ text: '\ud83d\udcc5 Monthly Summary', callback_data: 'export_monthly' }],
            [{ text: '\u274c Cancel', callback_data: 'export_cancel' }]
        ]
    };

    console.log('📤 Keyboard callback_data values:', keyboard.inline_keyboard.flat().map(b => b.callback_data));


    botInstance.sendMessage(chatId, '\ud83d\udcca <b>Select Export Type:</b>', {
        parse_mode: 'HTML',
        reply_markup: keyboard
    });
}

// Handle callback queries (button clicks)
async function handleCallbackQuery(query, botInstance) {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data;

    // Answer callback to remove loading state
    botInstance.answerCallbackQuery(query.id);

    if (data === 'export_cancel') {
        botInstance.editMessageText('\u274c Export cancelled', {
            chat_id: chatId,
            message_id: query.message.message_id
        });
        userStates.delete(userId);
        return;
    }

    if (data === 'export_individual') {
        userStates.set(userId, { type: 'individual', step: 'select_employee' });
        await showEmployeeList(chatId, botInstance, query.message.message_id);
    } else if (data === 'export_bulk') {
        userStates.set(userId, { type: 'bulk', step: 'select_range' });
        await showDateRangeOptions(chatId, botInstance, query.message.message_id, 'bulk');
    } else if (data === 'export_monthly') {
        userStates.set(userId, { type: 'monthly', step: 'select_month' });
        await showMonthOptions(chatId, botInstance, query.message.message_id);
    } else if (data.startsWith('employee_')) {
        const employeeId = parseInt(data.split('_')[1]);
        const state = userStates.get(userId);
        if (state) {
            state.employeeId = employeeId;
            state.step = 'select_range';
            userStates.set(userId, state);
            await showDateRangeOptions(chatId, botInstance, query.message.message_id, 'individual');
        }
    } else if (data.startsWith('range_')) {
        await handleDateRangeSelection(chatId, botInstance, userId, data, query.message.message_id);
    } else if (data.startsWith('month_')) {
        await handleMonthSelection(chatId, botInstance, userId, data, query.message.message_id);
    }
}

// Show employee list for selection
async function showEmployeeList(chatId, botInstance, messageId) {
    try {
        const result = await dbPool.query(
            `SELECT id, full_name, employee_id, department
             FROM users
             WHERE role = 'employee' AND is_active = true
             ORDER BY full_name
             LIMIT 20`
        );

        if (result.rows.length === 0) {
            botInstance.editMessageText('\u274c No employees found', {
                chat_id: chatId,
                message_id: messageId
            });
            return;
        }

        const keyboard = {
            inline_keyboard: result.rows.map(emp => [{
                text: `${emp.full_name} (${emp.employee_id})`,
                callback_data: `employee_${emp.id}`
            }]).concat([[{ text: '\u274c Cancel', callback_data: 'export_cancel' }]])
        };

        botInstance.editMessageText('\ud83d\udc64 <b>Select Employee:</b>', {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: keyboard
        });
    } catch (error) {
        console.error('Error showing employee list:', error);
        botInstance.editMessageText('\u274c Failed to load employees', {
            chat_id: chatId,
            message_id: messageId
        });
    }
}

// Show date range options
async function showDateRangeOptions(chatId, botInstance, messageId, exportType) {
    const keyboard = {
        inline_keyboard: [
            [{ text: '\ud83d\udcc5 Today', callback_data: 'range_today' }],
            [{ text: '\ud83d\udcc5 This Week', callback_data: 'range_week' }],
            [{ text: '\ud83d\udcc5 Last Week', callback_data: 'range_lastweek' }],
            [{ text: '\ud83d\udcc5 This Month', callback_data: 'range_month' }],
            [{ text: '\ud83d\udcc5 Last Month', callback_data: 'range_lastmonth' }],
            [{ text: '\u274c Cancel', callback_data: 'export_cancel' }]
        ]
    };

    botInstance.editMessageText('\ud83d\udcc5 <b>Select Date Range:</b>', {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: keyboard
    });
}

// Show month options for monthly summary
async function showMonthOptions(chatId, botInstance, messageId) {
    const now = new Date();
    const months = [];

    for (let i = 0; i < 6; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        months.push([{
            text: monthName,
            callback_data: `month_${date.getFullYear()}_${date.getMonth() + 1}`
        }]);
    }

    months.push([{ text: '\u274c Cancel', callback_data: 'export_cancel' }]);

    const keyboard = { inline_keyboard: months };

    botInstance.editMessageText('\ud83d\udcc5 <b>Select Month:</b>', {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: keyboard
    });
}

// Handle date range selection and generate report
async function handleDateRangeSelection(chatId, botInstance, userId, data, messageId) {
    const state = userStates.get(userId);
    if (!state) return;

    const rangeParts = data.split('_');
    const rangeType = rangeParts[1];

    let startDate, endDate;
    const now = new Date();

    switch (rangeType) {
        case 'today':
            startDate = endDate = now.toISOString().split('T')[0];
            break;
        case 'week': {
            const start = new Date(now);
            start.setDate(now.getDate() - now.getDay());
            startDate = start.toISOString().split('T')[0];
            endDate = now.toISOString().split('T')[0];
            break;
        }
        case 'lastweek': {
            const start = new Date(now);
            start.setDate(now.getDate() - now.getDay() - 7);
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            startDate = start.toISOString().split('T')[0];
            endDate = end.toISOString().split('T')[0];
            break;
        }
        case 'month': {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            startDate = start.toISOString().split('T')[0];
            endDate = now.toISOString().split('T')[0];
            break;
        }
        case 'lastmonth': {
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const end = new Date(now.getFullYear(), now.getMonth(), 0);
            startDate = start.toISOString().split('T')[0];
            endDate = end.toISOString().split('T')[0];
            break;
        }
    }

    botInstance.editMessageText('\u23f3 <b>Generating report...</b>', {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML'
    });

    try {
        if (state.type === 'individual') {
            await generateAndSendIndividualReport(chatId, botInstance, state.employeeId, startDate, endDate);
        } else if (state.type === 'bulk') {
            await generateAndSendBulkReport(chatId, botInstance, startDate, endDate);
        }
        userStates.delete(userId);
    } catch (error) {
        console.error('Error generating report:', error);
        botInstance.sendMessage(chatId, '\u274c Failed to generate report: ' + error.message);
    }
}

// Handle month selection and generate monthly summary
async function handleMonthSelection(chatId, botInstance, userId, data, messageId) {
    const parts = data.split('_');
    const year = parseInt(parts[1]);
    const month = parseInt(parts[2]);

    botInstance.editMessageText('\u23f3 <b>Generating monthly summary...</b>', {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML'
    });

    try {
        await generateAndSendMonthlySummary(chatId, botInstance, year, month);
        userStates.delete(userId);
    } catch (error) {
        console.error('Error generating monthly summary:', error);
        botInstance.sendMessage(chatId, '\u274c Failed to generate monthly summary: ' + error.message);
    }
}

// Generate and send individual report
async function generateAndSendIndividualReport(chatId, botInstance, employeeId, startDate, endDate) {
    const employeeResult = await dbPool.query(
        `SELECT id, full_name, employee_id, department, email, created_at
         FROM users WHERE id = $1`,
        [employeeId]
    );

    if (employeeResult.rows.length === 0) {
        throw new Error('Employee not found');
    }

    const employee = employeeResult.rows[0];

    const attendanceResult = await dbPool.query(
        `SELECT date, status, work_hours_start, work_hours_end, notes
         FROM attendance
         WHERE user_id = $1 AND date BETWEEN $2 AND $3
         ORDER BY date ASC`,
        [employeeId, startDate, endDate]
    );

    const allDates = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];
        const record = attendanceResult.rows.find(r => r.date.toISOString().split('T')[0] === dateStr);
        allDates.push({
            date: dateStr,
            status: record?.status || null,
            work_hours_start: record?.work_hours_start || null,
            work_hours_end: record?.work_hours_end || null,
            notes: record?.notes || null
        });
        current.setDate(current.getDate() + 1);
    }

    const { buffer, filename } = await generateIndividualReport(employee, allDates, { startDate, endDate });

    // Convert buffer to Stream for Telegram
    const { Readable } = await import('stream');
    const stream = Readable.from(buffer);
    stream.path = filename;

    await botInstance.sendDocument(chatId, stream, {
        caption: `📊 *Individual Report*\n👤 ${employee.full_name}\n📅 ${startDate} to ${endDate}`,
        parse_mode: 'Markdown'
    });
}

// Generate and send bulk report
async function generateAndSendBulkReport(chatId, botInstance, startDate, endDate) {
    const { buffer, filename } = await generateBulkReport(dbPool, { startDate, endDate });

    // Convert buffer to Stream for Telegram
    const { Readable } = await import('stream');
    const stream = Readable.from(buffer);
    stream.path = filename;

    await botInstance.sendDocument(chatId, stream, {
        caption: `📊 *Bulk Report - All Employees*\n📅 ${startDate} to ${endDate}`,
        parse_mode: 'Markdown'
    });
}

// Generate and send monthly summary
async function generateAndSendMonthlySummary(chatId, botInstance, year, month) {
    const { buffer, filename } = await generateMonthlySummary(dbPool, year, month);

    const monthName = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Convert buffer to Stream for Telegram
    const { Readable } = await import('stream');
    const stream = Readable.from(buffer);
    stream.path = filename;

    await botInstance.sendDocument(chatId, stream, {
        caption: `📊 *Monthly Summary*\n📅 ${monthName}`,
        parse_mode: 'Markdown'
    });
}

// Quick export commands
async function exportToday(chatId, botInstance, userId) {
    console.log(`📥 /export_today called by user ${userId}`);

    const adminStatus = await isAdmin(userId);
    if (!adminStatus) {
        console.log(`❌ User ${userId} is not an admin`);
        botInstance.sendMessage(chatId, '❌ This command is only available for admins');
        return;
    }

    botInstance.sendMessage(chatId, '\u23f3 <b>Generating today\'s report...</b>', { parse_mode: 'HTML' });

    try {
        const today = new Date().toISOString().split('T')[0];
        await generateAndSendBulkReport(chatId, botInstance, today, today);
    } catch (error) {
        console.error('Error in export_today:', error);
        botInstance.sendMessage(chatId, '\u274c Failed to generate report');
    }
}

async function exportWeek(chatId, botInstance, userId) {
    if (!await isAdmin(userId)) {
        botInstance.sendMessage(chatId, '\u274c This command is only available for admins');
        return;
    }

    botInstance.sendMessage(chatId, '\u23f3 <b>Generating this week\'s report...</b>', { parse_mode: 'HTML' });

    try {
        const now = new Date();
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
        const startDate = start.toISOString().split('T')[0];
        const endDate = now.toISOString().split('T')[0];

        await generateAndSendBulkReport(chatId, botInstance, startDate, endDate);
    } catch (error) {
        console.error('Error in export_week:', error);
        botInstance.sendMessage(chatId, '\u274c Failed to generate report');
    }
}

async function exportMonth(chatId, botInstance, userId) {
    if (!await isAdmin(userId)) {
        botInstance.sendMessage(chatId, '\u274c This command is only available for admins');
        return;
    }

    botInstance.sendMessage(chatId, '\u23f3 <b>Generating this month\'s summary...</b>', { parse_mode: 'HTML' });

    try {
        const now = new Date();
        await generateAndSendMonthlySummary(chatId, botInstance, now.getFullYear(), now.getMonth() + 1);
    } catch (error) {
        console.error('Error in export_month:', error);
        botInstance.sendMessage(chatId, '\u274c Failed to generate report');
    }
}

// Check if user is admin by Telegram ID
async function isAdmin(telegramUserId) {
    if (!dbPool) {
        console.error('❌ isAdmin check failed: dbPool not initialized');
        return false;
    }

    try {
        console.log(`🔍 Checking admin status for Telegram ID: ${telegramUserId}`);
        const result = await dbPool.query(
            'SELECT role FROM users WHERE telegram_id = $1',
            [telegramUserId]
        );

        console.log(`📊 Query result for Telegram ID ${telegramUserId}:`, result.rows);

        const isAdminUser = result.rows.length > 0 && result.rows[0].role === 'admin';
        console.log(`${isAdminUser ? '✅' : '❌'} Admin check result: ${isAdminUser}`);

        return isAdminUser;
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
}
