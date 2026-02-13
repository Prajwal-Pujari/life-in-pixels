// ==================== TELEGRAM USER COMMANDS ====================
// Employee self-service commands for Telegram bot
// Includes: Email verification, Check-in/out, Expenses, Leave requests

import { sendVerificationCodeEmail, isEmailServiceAvailable } from './email-service.js';

let dbPool = null;

// Initialize with database pool
export function setUserCommandsDbPool(pool) {
    dbPool = pool;
    console.log('✅ Database pool set for user commands');
}

// Generate 6-digit verification code
function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Format time for display
function formatTime(date) {
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

// Format date for display
function formatDate(date) {
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
}

// Get user by telegram_id
async function getUserByTelegramId(telegramId) {
    if (!dbPool) return null;
    const result = await dbPool.query(
        `SELECT id, full_name, email, employee_id, department, role, is_active, is_approved
         FROM users WHERE telegram_id = $1`,
        [telegramId]
    );
    return result.rows[0] || null;
}

// ==================== VERIFICATION COMMANDS ====================

/**
 * Handle /verify command - Start email verification
 * Usage: /verify your.email@company.com
 */
export async function handleVerifyCommand(msg, botInstance) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const text = msg.text || '';
    const parts = text.trim().split(/\s+/);

    if (parts.length < 2 || !parts[1]) {
        return botInstance.sendMessage(chatId,
            `📧 <b>Email Verification</b>\n\n` +
            `To link your Telegram account, send your registered work email:\n` +
            `<code>/verify your.email@company.com</code>\n\n` +
            `<i>Your email must match the one registered in the system.</i>`,
            { parse_mode: 'HTML' }
        );
    }

    const email = parts[1].toLowerCase().trim();

    if (!dbPool) {
        return botInstance.sendMessage(chatId, '❌ Database not available. Please try again later.');
    }

    try {
        // Check if this telegram_id is already linked
        const existingUser = await getUserByTelegramId(telegramId);
        if (existingUser) {
            const roleEmoji = existingUser.role === 'admin' ? '👑 ADMIN' : '👔 Employee';
            return botInstance.sendMessage(chatId,
                `✅ <b>Already Verified!</b>\n\n` +
                `👤 ${existingUser.full_name}\n` +
                `🆔 ${existingUser.employee_id}\n` +
                `🏢 ${existingUser.department || 'Not set'}\n` +
                `${roleEmoji}\n\n` +
                `<i>Your Telegram is already linked to this account.</i>`,
                { parse_mode: 'HTML' }
            );
        }

        // Check if email exists in users table
        const userResult = await dbPool.query(
            `SELECT id, full_name, employee_id, telegram_id 
             FROM users 
             WHERE LOWER(email) = $1 OR LOWER(google_email) = $1`,
            [email]
        );

        if (userResult.rows.length === 0) {
            return botInstance.sendMessage(chatId,
                `❌ <b>Email Not Found</b>\n\n` +
                `The email <code>${email}</code> is not registered in the system.\n\n` +
                `Please use the email you registered with, or contact admin if you need help.`,
                { parse_mode: 'HTML' }
            );
        }

        const user = userResult.rows[0];

        // Check if this user is already linked to another Telegram
        if (user.telegram_id && user.telegram_id !== telegramId) {
            return botInstance.sendMessage(chatId,
                `⚠️ <b>Already Linked</b>\n\n` +
                `This email is already linked to another Telegram account.\n\n` +
                `Contact admin if you need to change your linked account.`,
                { parse_mode: 'HTML' }
            );
        }

        // Generate verification code
        const code = generateVerificationCode();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        // Delete any existing codes for this telegram_id
        await dbPool.query(
            'DELETE FROM telegram_verification_codes WHERE telegram_id = $1',
            [telegramId]
        );

        // Insert new verification code
        await dbPool.query(
            `INSERT INTO telegram_verification_codes 
             (telegram_id, telegram_username, telegram_first_name, email, verification_code, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                telegramId,
                msg.from.username || null,
                msg.from.first_name || null,
                email,
                code,
                expiresAt
            ]
        );

        console.log(`📱 Verification code generated for ${email}: ${code}`);

        // Send verification code via EMAIL (more secure)
        const emailSent = await sendVerificationCodeEmail(email, code, user.full_name);

        if (emailSent) {
            // Send confirmation to Telegram
            await botInstance.sendMessage(chatId,
                `📧 <b>Verification Code Sent!</b>\n\n` +
                `A verification code has been sent to:\n` +
                `<code>${email}</code>\n\n` +
                `📬 Check your email inbox and reply here with:\n` +
                `<code>/code YOUR_CODE</code>\n\n` +
                `<i>⏰ Code expires in 15 minutes.</i>\n` +
                `<i>💡 Check spam folder if not received.</i>`,
                { parse_mode: 'HTML' }
            );
        } else {
            // Email service not available - show code in Telegram as fallback
            await botInstance.sendMessage(chatId,
                `🔐 <b>Verification Code</b>\n\n` +
                `Your code for <b>${user.full_name}</b>:\n\n` +
                `<code>${code}</code>\n\n` +
                `➡️ Reply with: <code>/code ${code}</code>\n\n` +
                `<i>⚠️ Email service unavailable - code shown here.</i>\n` +
                `<i>Code expires in 15 minutes.</i>`,
                { parse_mode: 'HTML' }
            );
        }

    } catch (error) {
        console.error('❌ Error in verify command:', error);
        botInstance.sendMessage(chatId, '❌ An error occurred. Please try again later.');
    }
}

/**
 * Handle /code command - Complete verification with code
 * Usage: /code 123456
 */
export async function handleCodeCommand(msg, botInstance) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const text = msg.text || '';
    const parts = text.trim().split(/\s+/);

    if (parts.length < 2 || !parts[1]) {
        return botInstance.sendMessage(chatId,
            `🔢 <b>Enter Verification Code</b>\n\n` +
            `Usage: <code>/code 123456</code>\n\n` +
            `Need a code? Use <code>/verify your.email@company.com</code>`,
            { parse_mode: 'HTML' }
        );
    }

    const enteredCode = parts[1].trim();

    if (!dbPool) {
        return botInstance.sendMessage(chatId, '❌ Database not available. Please try again later.');
    }

    try {
        // Find verification record
        const verifyResult = await dbPool.query(
            `SELECT * FROM telegram_verification_codes 
             WHERE telegram_id = $1 AND verification_code = $2 AND expires_at > NOW() AND verified = FALSE`,
            [telegramId, enteredCode]
        );

        if (verifyResult.rows.length === 0) {
            // Check if code exists but expired or wrong
            const anyCode = await dbPool.query(
                'SELECT * FROM telegram_verification_codes WHERE telegram_id = $1',
                [telegramId]
            );

            if (anyCode.rows.length > 0) {
                // Update attempts
                await dbPool.query(
                    'UPDATE telegram_verification_codes SET attempts = attempts + 1 WHERE telegram_id = $1',
                    [telegramId]
                );

                if (anyCode.rows[0].expires_at < new Date()) {
                    return botInstance.sendMessage(chatId,
                        `⏰ <b>Code Expired</b>\n\n` +
                        `Your verification code has expired.\n\n` +
                        `Please request a new code with:\n<code>/verify your.email@company.com</code>`,
                        { parse_mode: 'HTML' }
                    );
                }
            }

            return botInstance.sendMessage(chatId,
                `❌ <b>Invalid Code</b>\n\n` +
                `The code you entered is incorrect.\n\n` +
                `Try again or request a new code.`,
                { parse_mode: 'HTML' }
            );
        }

        const verification = verifyResult.rows[0];

        // Find the user and link telegram_id
        const userResult = await dbPool.query(
            `UPDATE users 
             SET telegram_id = $1, telegram_chat_id = $2
             WHERE LOWER(email) = $3 OR LOWER(google_email) = $3
             RETURNING id, full_name, employee_id, department, role`,
            [telegramId, chatId, verification.email]
        );

        if (userResult.rows.length === 0) {
            return botInstance.sendMessage(chatId, '❌ User not found. Please try again.');
        }

        const user = userResult.rows[0];

        // Mark verification as complete
        await dbPool.query(
            'UPDATE telegram_verification_codes SET verified = TRUE WHERE id = $1',
            [verification.id]
        );

        // Log activity
        await dbPool.query(
            'INSERT INTO activity_log (user_id, action_type, action_details) VALUES ($1, $2, $3)',
            [user.id, 'telegram_linked', `Linked Telegram account @${msg.from.username || telegramId}`]
        );

        console.log(`✅ Telegram linked for user ${user.full_name} (${user.employee_id}) - Role: ${user.role}`);

        // Build role-specific welcome message
        const isAdmin = user.role === 'admin';
        const roleEmoji = isAdmin ? '👑 ADMIN' : '👔 Employee';

        let commandsList = `/checkin - Mark entry time\n` +
            `/checkout - Mark exit time\n` +
            `/mystatus - View today's status\n`;

        if (user.department === 'Calibration') {
            commandsList += `/expense - Add expense item\n`;
        }

        commandsList += `/leave - Request leave\n`;

        if (isAdmin) {
            commandsList += `\n<b>Admin Commands:</b>\n` +
                `/summary - Today's attendance\n` +
                `/present - Present employees\n` +
                `/export - Generate Excel reports\n` +
                `/stats - Quick statistics`;
        }

        commandsList += `\n/help - Show all commands`;

        // Send success message
        await botInstance.sendMessage(chatId,
            `✅ <b>Verification Successful!</b>\n\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `👤 <b>${user.full_name}</b>\n` +
            `🆔 ${user.employee_id}\n` +
            `🏢 ${user.department || 'Not set'}\n` +
            `${roleEmoji}\n` +
            `━━━━━━━━━━━━━━━━━━\n\n` +
            `🎉 Your Telegram is now linked!\n\n` +
            `<b>Available Commands:</b>\n` +
            commandsList,
            { parse_mode: 'HTML' }
        );

    } catch (error) {
        console.error('❌ Error in code command:', error);
        botInstance.sendMessage(chatId, '❌ An error occurred. Please try again later.');
    }
}

// ==================== ATTENDANCE COMMANDS ====================

/**
 * Handle /checkin command - Mark entry time
 */
export async function handleCheckinCommand(msg, botInstance) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    if (!dbPool) {
        return botInstance.sendMessage(chatId, '❌ Database not available.');
    }

    try {
        // Get verified user
        const user = await getUserByTelegramId(telegramId);
        if (!user) {
            return botInstance.sendMessage(chatId,
                `🔐 <b>Verification Required</b>\n\n` +
                `Please verify your account first:\n` +
                `<code>/verify your.email@company.com</code>`,
                { parse_mode: 'HTML' }
            );
        }

        if (!user.is_approved || !user.is_active) {
            return botInstance.sendMessage(chatId, '❌ Your account is not active or pending approval.');
        }

        const today = new Date().toISOString().split('T')[0];
        const now = new Date();
        const currentTime = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM

        // Check if already checked in today
        const existingAttendance = await dbPool.query(
            'SELECT id, status, work_hours_start FROM attendance WHERE user_id = $1 AND date = $2',
            [user.id, today]
        );

        if (existingAttendance.rows.length > 0 && existingAttendance.rows[0].work_hours_start) {
            const existingTime = existingAttendance.rows[0].work_hours_start;
            return botInstance.sendMessage(chatId,
                `⏰ <b>Already Checked In</b>\n\n` +
                `You checked in at ${formatTime(new Date(`2000-01-01T${existingTime}`))}\n\n` +
                `Use /checkout to mark exit time.`,
                { parse_mode: 'HTML' }
            );
        }

        // Create or update attendance record
        if (existingAttendance.rows.length > 0) {
            // Update existing record
            await dbPool.query(
                `UPDATE attendance SET work_hours_start = $1, marked_at = NOW() WHERE id = $2`,
                [currentTime, existingAttendance.rows[0].id]
            );
        } else {
            // Create new attendance record
            await dbPool.query(
                `INSERT INTO attendance (user_id, date, status, work_hours_start, marked_at)
                 VALUES ($1, $2, 'present', $3, NOW())`,
                [user.id, today, currentTime]
            );
        }

        // Log activity
        await dbPool.query(
            'INSERT INTO activity_log (user_id, action_type, action_details) VALUES ($1, $2, $3)',
            [user.id, 'telegram_checkin', `Checked in via Telegram at ${currentTime}`]
        );

        console.log(`✅ ${user.full_name} checked in at ${currentTime}`);

        await botInstance.sendMessage(chatId,
            `✅ <b>Checked In!</b>\n\n` +
            `👤 ${user.full_name}\n` +
            `📅 ${formatDate(now)}\n` +
            `⏰ Entry: <b>${formatTime(now)}</b>\n\n` +
            `<i>Don't forget to /checkout when leaving!</i>`,
            { parse_mode: 'HTML' }
        );

    } catch (error) {
        console.error('❌ Error in checkin command:', error);
        botInstance.sendMessage(chatId, '❌ An error occurred. Please try again.');
    }
}

/**
 * Handle /checkout command - Mark exit time
 */
export async function handleCheckoutCommand(msg, botInstance) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    if (!dbPool) {
        return botInstance.sendMessage(chatId, '❌ Database not available.');
    }

    try {
        // Get verified user
        const user = await getUserByTelegramId(telegramId);
        if (!user) {
            return botInstance.sendMessage(chatId,
                `🔐 <b>Verification Required</b>\n\n` +
                `Please verify your account first:\n` +
                `<code>/verify your.email@company.com</code>`,
                { parse_mode: 'HTML' }
            );
        }

        const today = new Date().toISOString().split('T')[0];
        const now = new Date();
        const currentTime = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM

        // Check if checked in today
        const existingAttendance = await dbPool.query(
            'SELECT id, work_hours_start, work_hours_end FROM attendance WHERE user_id = $1 AND date = $2',
            [user.id, today]
        );

        if (existingAttendance.rows.length === 0) {
            return botInstance.sendMessage(chatId,
                `❌ <b>Not Checked In</b>\n\n` +
                `You haven't checked in today yet.\n\n` +
                `Use /checkin first to mark your entry time.`,
                { parse_mode: 'HTML' }
            );
        }

        const attendance = existingAttendance.rows[0];

        if (!attendance.work_hours_start) {
            return botInstance.sendMessage(chatId,
                `❌ <b>No Entry Time</b>\n\n` +
                `Use /checkin first to mark your entry time.`,
                { parse_mode: 'HTML' }
            );
        }

        // Update checkout time
        await dbPool.query(
            `UPDATE attendance SET work_hours_end = $1 WHERE id = $2`,
            [currentTime, attendance.id]
        );

        // Calculate hours worked
        const [startHours, startMins] = attendance.work_hours_start.split(':').map(Number);
        const [endHours, endMins] = currentTime.split(':').map(Number);
        const totalMinutes = (endHours * 60 + endMins) - (startHours * 60 + startMins);
        const hoursWorked = Math.floor(totalMinutes / 60);
        const minsWorked = totalMinutes % 60;

        // Log activity
        await dbPool.query(
            'INSERT INTO activity_log (user_id, action_type, action_details) VALUES ($1, $2, $3)',
            [user.id, 'telegram_checkout', `Checked out via Telegram at ${currentTime} (${hoursWorked}h ${minsWorked}m)`]
        );

        console.log(`✅ ${user.full_name} checked out at ${currentTime}`);

        await botInstance.sendMessage(chatId,
            `✅ <b>Checked Out!</b>\n\n` +
            `👤 ${user.full_name}\n` +
            `📅 ${formatDate(now)}\n` +
            `⏰ Entry: ${formatTime(new Date(`2000-01-01T${attendance.work_hours_start}`))}\n` +
            `⏰ Exit: <b>${formatTime(now)}</b>\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `📊 Total: <b>${hoursWorked}h ${minsWorked}m</b>\n\n` +
            `<i>Have a great evening! 👋</i>`,
            { parse_mode: 'HTML' }
        );

    } catch (error) {
        console.error('❌ Error in checkout command:', error);
        botInstance.sendMessage(chatId, '❌ An error occurred. Please try again.');
    }
}

/**
 * Handle /mystatus command - View today's attendance status
 */
export async function handleMyStatusCommand(msg, botInstance) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    if (!dbPool) {
        return botInstance.sendMessage(chatId, '❌ Database not available.');
    }

    try {
        // Get verified user
        const user = await getUserByTelegramId(telegramId);
        if (!user) {
            return botInstance.sendMessage(chatId,
                `🔐 <b>Verification Required</b>\n\n` +
                `Please verify your account first:\n` +
                `<code>/verify your.email@company.com</code>`,
                { parse_mode: 'HTML' }
            );
        }

        const today = new Date().toISOString().split('T')[0];
        const now = new Date();

        // Get today's attendance
        const attendanceResult = await dbPool.query(
            `SELECT status, work_hours_start, work_hours_end, notes, marked_at 
             FROM attendance WHERE user_id = $1 AND date = $2`,
            [user.id, today]
        );

        if (attendanceResult.rows.length === 0) {
            return botInstance.sendMessage(chatId,
                `📋 <b>Today's Status</b>\n\n` +
                `👤 ${user.full_name}\n` +
                `📅 ${formatDate(now)}\n` +
                `━━━━━━━━━━━━━━━━━━\n` +
                `⚠️ <b>Not marked yet</b>\n\n` +
                `Use /checkin to start your day!`,
                { parse_mode: 'HTML' }
            );
        }

        const att = attendanceResult.rows[0];
        const statusEmoji = {
            'present': '✅',
            'wfh': '🏠',
            'half_day': '⏰',
            'on_leave': '🌴',
            'leave': '🌴',
            'absent': '❌'
        };

        let message = `📋 <b>Today's Status</b>\n\n`;
        message += `👤 ${user.full_name}\n`;
        message += `📅 ${formatDate(now)}\n`;
        message += `━━━━━━━━━━━━━━━━━━\n`;
        message += `${statusEmoji[att.status] || '❓'} Status: <b>${att.status.toUpperCase().replace('_', ' ')}</b>\n`;

        if (att.work_hours_start) {
            message += `⏰ Entry: ${formatTime(new Date(`2000-01-01T${att.work_hours_start}`))}\n`;
        }

        if (att.work_hours_end) {
            message += `⏰ Exit: ${formatTime(new Date(`2000-01-01T${att.work_hours_end}`))}\n`;

            // Calculate hours
            const [startH, startM] = att.work_hours_start.split(':').map(Number);
            const [endH, endM] = att.work_hours_end.split(':').map(Number);
            const totalMins = (endH * 60 + endM) - (startH * 60 + startM);
            message += `📊 Total: <b>${Math.floor(totalMins / 60)}h ${totalMins % 60}m</b>\n`;
        } else if (att.work_hours_start) {
            message += `\n<i>Don't forget to /checkout!</i>`;
        }

        if (att.notes) {
            message += `\n📝 Note: ${att.notes}`;
        }

        await botInstance.sendMessage(chatId, message, { parse_mode: 'HTML' });

    } catch (error) {
        console.error('❌ Error in mystatus command:', error);
        botInstance.sendMessage(chatId, '❌ An error occurred. Please try again.');
    }
}

// ==================== EXPENSE COMMANDS (CALIBRATION ONLY) ====================

/**
 * Handle /expense command - Add expense item (Calibration department only)
 * Usage: /expense Petrol - 170 or /expense Food - 80 for lunch
 */
export async function handleExpenseCommand(msg, botInstance) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const text = msg.text || '';

    if (!dbPool) {
        return botInstance.sendMessage(chatId, '❌ Database not available.');
    }

    try {
        // Get verified user
        const user = await getUserByTelegramId(telegramId);
        if (!user) {
            return botInstance.sendMessage(chatId,
                `🔐 <b>Verification Required</b>\n\n` +
                `Please verify your account first:\n` +
                `<code>/verify your.email@company.com</code>`,
                { parse_mode: 'HTML' }
            );
        }

        // Check if Calibration department
        if (user.department !== 'Calibration') {
            return botInstance.sendMessage(chatId,
                `⚠️ <b>Access Denied</b>\n\n` +
                `This feature is only available for Calibration department employees.`,
                { parse_mode: 'HTML' }
            );
        }

        // Parse expense: "/expense Type - Amount Description"
        const expenseText = text.replace(/^\/expense\s*/i, '').trim();

        if (!expenseText) {
            return botInstance.sendMessage(chatId,
                `💰 <b>Add Expense</b>\n\n` +
                `Format: <code>/expense Type - Amount Description</code>\n\n` +
                `Examples:\n` +
                `• <code>/expense Petrol - 170</code>\n` +
                `• <code>/expense Food - 80 for lunch</code>\n` +
                `• <code>/expense Cab - 250 to site</code>\n\n` +
                `Commands:\n` +
                `/expenses - View today's expenses\n` +
                `/submit - Submit for approval`,
                { parse_mode: 'HTML' }
            );
        }

        // Parse format: "Type - Amount [Description]"
        const match = expenseText.match(/^(.+?)\s*-\s*(\d+(?:\.\d{1,2})?)\s*(.*)$/);

        if (!match) {
            return botInstance.sendMessage(chatId,
                `❌ <b>Invalid Format</b>\n\n` +
                `Use: <code>/expense Type - Amount</code>\n` +
                `Example: <code>/expense Petrol - 170</code>`,
                { parse_mode: 'HTML' }
            );
        }

        const [, expenseType, amountStr, description] = match;
        const amount = parseFloat(amountStr);

        if (amount <= 0 || amount > 100000) {
            return botInstance.sendMessage(chatId, '❌ Invalid amount. Must be between 1 and 100000.');
        }

        const today = new Date().toISOString().split('T')[0];

        // Get or create today's attendance and site visit
        let attendanceResult = await dbPool.query(
            'SELECT id FROM attendance WHERE user_id = $1 AND date = $2',
            [user.id, today]
        );

        let attendanceId;
        if (attendanceResult.rows.length === 0) {
            // Create attendance record
            const newAtt = await dbPool.query(
                `INSERT INTO attendance (user_id, date, status, is_site_visit) 
                 VALUES ($1, $2, 'present', true) RETURNING id`,
                [user.id, today]
            );
            attendanceId = newAtt.rows[0].id;
        } else {
            attendanceId = attendanceResult.rows[0].id;
            await dbPool.query(
                'UPDATE attendance SET is_site_visit = true WHERE id = $1',
                [attendanceId]
            );
        }

        // Get or create site visit details
        let siteVisitResult = await dbPool.query(
            'SELECT id FROM site_visit_details WHERE attendance_id = $1',
            [attendanceId]
        );

        let siteVisitId;
        if (siteVisitResult.rows.length === 0) {
            // Create site visit with placeholder location
            const newSV = await dbPool.query(
                `INSERT INTO site_visit_details (attendance_id, user_id, visit_date, location, status)
                 VALUES ($1, $2, $3, 'Via Telegram', 'draft') RETURNING id`,
                [attendanceId, user.id, today]
            );
            siteVisitId = newSV.rows[0].id;
        } else {
            siteVisitId = siteVisitResult.rows[0].id;
        }

        // Insert expense
        await dbPool.query(
            `INSERT INTO site_visit_expenses (site_visit_id, expense_type, amount, description)
             VALUES ($1, $2, $3, $4)`,
            [siteVisitId, expenseType.trim(), amount, description.trim() || null]
        );

        // Get total expenses for today
        const totalResult = await dbPool.query(
            `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count 
             FROM site_visit_expenses WHERE site_visit_id = $1`,
            [siteVisitId]
        );

        const { total, count } = totalResult.rows[0];

        console.log(`💰 ${user.full_name} added expense: ${expenseType} - ₹${amount}`);

        await botInstance.sendMessage(chatId,
            `✅ <b>Expense Added!</b>\n\n` +
            `📝 ${expenseType.trim()} - ₹${amount}${description ? ` (${description.trim()})` : ''}\n\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `📊 Today's Total: <b>₹${parseFloat(total).toFixed(2)}</b> (${count} items)\n\n` +
            `<i>Use /submit when ready for approval</i>`,
            { parse_mode: 'HTML' }
        );

    } catch (error) {
        console.error('❌ Error in expense command:', error);
        botInstance.sendMessage(chatId, '❌ An error occurred. Please try again.');
    }
}

/**
 * Handle /expenses command - View today's expenses
 */
export async function handleExpensesCommand(msg, botInstance) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    if (!dbPool) {
        return botInstance.sendMessage(chatId, '❌ Database not available.');
    }

    try {
        const user = await getUserByTelegramId(telegramId);
        if (!user) {
            return botInstance.sendMessage(chatId,
                `🔐 <b>Verification Required</b>\n\n` +
                `Please verify first: <code>/verify your.email@company.com</code>`,
                { parse_mode: 'HTML' }
            );
        }

        if (user.department !== 'Calibration') {
            return botInstance.sendMessage(chatId, '⚠️ This feature is for Calibration department only.');
        }

        const today = new Date().toISOString().split('T')[0];

        // Get today's expenses
        const result = await dbPool.query(
            `SELECT sve.expense_type, sve.amount, sve.description, svd.status
             FROM site_visit_expenses sve
             JOIN site_visit_details svd ON sve.site_visit_id = svd.id
             WHERE svd.user_id = $1 AND svd.visit_date = $2
             ORDER BY sve.created_at`,
            [user.id, today]
        );

        if (result.rows.length === 0) {
            return botInstance.sendMessage(chatId,
                `📋 <b>Today's Expenses</b>\n\n` +
                `No expenses recorded yet.\n\n` +
                `Add with: <code>/expense Petrol - 170</code>`,
                { parse_mode: 'HTML' }
            );
        }

        let message = `📋 <b>Today's Expenses</b>\n\n`;
        let total = 0;
        let status = result.rows[0].status;

        result.rows.forEach((exp, i) => {
            message += `${i + 1}. ${exp.expense_type} - ₹${exp.amount}`;
            if (exp.description) message += ` <i>(${exp.description})</i>`;
            message += '\n';
            total += parseFloat(exp.amount);
        });

        message += `━━━━━━━━━━━━━━━━━━\n`;
        message += `📊 Total: <b>₹${total.toFixed(2)}</b>\n`;
        message += `📌 Status: ${status.toUpperCase()}\n`;

        if (status === 'draft') {
            message += `\n<i>Use /submit when ready for approval</i>`;
        }

        await botInstance.sendMessage(chatId, message, { parse_mode: 'HTML' });

    } catch (error) {
        console.error('❌ Error in expenses command:', error);
        botInstance.sendMessage(chatId, '❌ An error occurred. Please try again.');
    }
}

/**
 * Handle /submit command - Submit expenses for approval
 */
export async function handleSubmitCommand(msg, botInstance) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    if (!dbPool) {
        return botInstance.sendMessage(chatId, '❌ Database not available.');
    }

    try {
        const user = await getUserByTelegramId(telegramId);
        if (!user) {
            return botInstance.sendMessage(chatId,
                `🔐 <b>Verification Required</b>\n\n` +
                `Please verify first: <code>/verify your.email@company.com</code>`,
                { parse_mode: 'HTML' }
            );
        }

        if (user.department !== 'Calibration') {
            return botInstance.sendMessage(chatId, '⚠️ This feature is for Calibration department only.');
        }

        const today = new Date().toISOString().split('T')[0];

        // Get today's site visit
        const siteVisitResult = await dbPool.query(
            `SELECT svd.id, svd.status, COUNT(sve.id) as expense_count, COALESCE(SUM(sve.amount), 0) as total
             FROM site_visit_details svd
             LEFT JOIN site_visit_expenses sve ON svd.id = sve.site_visit_id
             WHERE svd.user_id = $1 AND svd.visit_date = $2
             GROUP BY svd.id, svd.status`,
            [user.id, today]
        );

        if (siteVisitResult.rows.length === 0 || siteVisitResult.rows[0].expense_count === 0) {
            return botInstance.sendMessage(chatId,
                `❌ <b>No Expenses to Submit</b>\n\n` +
                `Add expenses first with:\n<code>/expense Petrol - 170</code>`,
                { parse_mode: 'HTML' }
            );
        }

        const siteVisit = siteVisitResult.rows[0];

        if (siteVisit.status !== 'draft') {
            return botInstance.sendMessage(chatId,
                `⚠️ <b>Already Submitted</b>\n\n` +
                `Today's expenses are already ${siteVisit.status}.`,
                { parse_mode: 'HTML' }
            );
        }

        // Submit for approval
        await dbPool.query(
            `UPDATE site_visit_details 
             SET status = 'submitted', submitted_at = NOW() 
             WHERE id = $1`,
            [siteVisit.id]
        );

        // Create notification for admins
        const admins = await dbPool.query(
            'SELECT id FROM users WHERE role = $1 AND is_active = true',
            ['admin']
        );

        for (const admin of admins.rows) {
            await dbPool.query(
                `INSERT INTO notifications (user_id, type, title, message, link)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    admin.id,
                    'calibration_expense_submitted',
                    'New Site Visit Expense',
                    `${user.full_name} submitted expenses via Telegram - Total: ₹${siteVisit.total}`,
                    '/admin/calibration'
                ]
            );
        }

        // Log activity
        await dbPool.query(
            'INSERT INTO activity_log (user_id, action_type, action_details) VALUES ($1, $2, $3)',
            [user.id, 'telegram_expense_submit', `Submitted ₹${siteVisit.total} in expenses via Telegram`]
        );

        console.log(`📤 ${user.full_name} submitted expenses: ₹${siteVisit.total}`);

        await botInstance.sendMessage(chatId,
            `✅ <b>Expenses Submitted!</b>\n\n` +
            `📊 Total: <b>₹${parseFloat(siteVisit.total).toFixed(2)}</b>\n` +
            `📝 Items: ${siteVisit.expense_count}\n\n` +
            `Admin will review and approve your expenses.\n` +
            `You'll be notified when approved! 🔔`,
            { parse_mode: 'HTML' }
        );

    } catch (error) {
        console.error('❌ Error in submit command:', error);
        botInstance.sendMessage(chatId, '❌ An error occurred. Please try again.');
    }
}

// ==================== LEAVE REQUEST COMMANDS ====================

/**
 * Handle /leave command - Request leave
 * Usage: /leave 2026-02-01 2026-02-03 Family function
 */
export async function handleLeaveCommand(msg, botInstance) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const text = msg.text || '';

    if (!dbPool) {
        return botInstance.sendMessage(chatId, '❌ Database not available.');
    }

    try {
        const user = await getUserByTelegramId(telegramId);
        if (!user) {
            return botInstance.sendMessage(chatId,
                `🔐 <b>Verification Required</b>\n\n` +
                `Please verify first: <code>/verify your.email@company.com</code>`,
                { parse_mode: 'HTML' }
            );
        }

        const leaveText = text.replace(/^\/leave\s*/i, '').trim();

        if (!leaveText) {
            return botInstance.sendMessage(chatId,
                `🌴 <b>Request Leave</b>\n\n` +
                `Format: <code>/leave START END REASON</code>\n\n` +
                `Examples:\n` +
                `• <code>/leave 2026-02-01 2026-02-03 Family function</code>\n` +
                `• <code>/leave 2026-02-05 2026-02-05 Doctor appointment</code>\n\n` +
                `Use /myleaves to check your requests.`,
                { parse_mode: 'HTML' }
            );
        }

        // Parse: "YYYY-MM-DD YYYY-MM-DD Reason"
        const match = leaveText.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})\s+(.+)$/);

        if (!match) {
            return botInstance.sendMessage(chatId,
                `❌ <b>Invalid Format</b>\n\n` +
                `Use: <code>/leave YYYY-MM-DD YYYY-MM-DD Reason</code>\n` +
                `Example: <code>/leave 2026-02-01 2026-02-03 Family function</code>`,
                { parse_mode: 'HTML' }
            );
        }

        const [, startDate, endDate, reason] = match;

        // Validate dates
        const start = new Date(startDate);
        const end = new Date(endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return botInstance.sendMessage(chatId, '❌ Invalid date format. Use YYYY-MM-DD.');
        }

        if (start < today) {
            return botInstance.sendMessage(chatId, '❌ Start date cannot be in the past.');
        }

        if (end < start) {
            return botInstance.sendMessage(chatId, '❌ End date must be after start date.');
        }

        // Calculate days
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

        // Create leave request
        const result = await dbPool.query(
            `INSERT INTO leave_requests (user_id, start_date, end_date, leave_type, reason, status)
             VALUES ($1, $2, $3, 'casual', $4, 'pending')
             RETURNING id`,
            [user.id, startDate, endDate, reason.trim()]
        );

        // Notify admins
        const admins = await dbPool.query(
            'SELECT id FROM users WHERE role = $1 AND is_active = true',
            ['admin']
        );

        for (const admin of admins.rows) {
            await dbPool.query(
                `INSERT INTO notifications (user_id, type, title, message, link)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    admin.id,
                    'leave_request',
                    'New Leave Request',
                    `${user.full_name} requested ${days} day(s) leave: ${reason.trim()}`,
                    '/admin'
                ]
            );
        }

        // Log activity
        await dbPool.query(
            'INSERT INTO activity_log (user_id, action_type, action_details) VALUES ($1, $2, $3)',
            [user.id, 'telegram_leave_request', `Requested ${days} days leave via Telegram: ${reason}`]
        );

        console.log(`🌴 ${user.full_name} requested leave: ${startDate} to ${endDate}`);

        await botInstance.sendMessage(chatId,
            `✅ <b>Leave Request Submitted!</b>\n\n` +
            `📅 From: ${formatDate(start)}\n` +
            `📅 To: ${formatDate(end)}\n` +
            `📊 Days: ${days}\n` +
            `📝 Reason: ${reason.trim()}\n\n` +
            `Your request is pending approval. 🔔`,
            { parse_mode: 'HTML' }
        );

    } catch (error) {
        console.error('❌ Error in leave command:', error);
        botInstance.sendMessage(chatId, '❌ An error occurred. Please try again.');
    }
}

/**
 * Handle /myleaves command - Check leave requests status
 */
export async function handleMyLeavesCommand(msg, botInstance) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    if (!dbPool) {
        return botInstance.sendMessage(chatId, '❌ Database not available.');
    }

    try {
        const user = await getUserByTelegramId(telegramId);
        if (!user) {
            return botInstance.sendMessage(chatId,
                `🔐 <b>Verification Required</b>\n\n` +
                `Please verify first: <code>/verify your.email@company.com</code>`,
                { parse_mode: 'HTML' }
            );
        }

        // Get recent leave requests
        const result = await dbPool.query(
            `SELECT start_date, end_date, leave_type, reason, status, created_at
             FROM leave_requests 
             WHERE user_id = $1 
             ORDER BY created_at DESC 
             LIMIT 5`,
            [user.id]
        );

        if (result.rows.length === 0) {
            return botInstance.sendMessage(chatId,
                `🌴 <b>Your Leave Requests</b>\n\n` +
                `No leave requests found.\n\n` +
                `Request with: <code>/leave YYYY-MM-DD YYYY-MM-DD Reason</code>`,
                { parse_mode: 'HTML' }
            );
        }

        let message = `🌴 <b>Your Leave Requests</b>\n\n`;

        const statusEmoji = {
            'pending': '⏳',
            'approved': '✅',
            'rejected': '❌',
            'cancelled': '🚫'
        };

        result.rows.forEach((leave, i) => {
            const start = new Date(leave.start_date);
            const end = new Date(leave.end_date);
            const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

            message += `${i + 1}. ${statusEmoji[leave.status] || '❓'} <b>${leave.status.toUpperCase()}</b>\n`;
            message += `   📅 ${formatDate(start)} - ${formatDate(end)} (${days} day${days > 1 ? 's' : ''})\n`;
            message += `   📝 ${leave.reason || 'No reason'}\n\n`;
        });

        await botInstance.sendMessage(chatId, message, { parse_mode: 'HTML' });

    } catch (error) {
        console.error('❌ Error in myleaves command:', error);
        botInstance.sendMessage(chatId, '❌ An error occurred. Please try again.');
    }
}

// ==================== HELP COMMAND ====================

/**
 * Handle /help command for verified users - Show personalized help
 */
export async function handleUserHelpCommand(msg, botInstance) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    try {
        const user = dbPool ? await getUserByTelegramId(telegramId) : null;

        let message = `📖 <b>Life In Pixels Bot Help</b>\n\n`;

        if (!user) {
            message += `<b>🔐 First, verify your account:</b>\n`;
            message += `/verify [email] - Link your account\n\n`;
            message += `<i>Example: /verify your.email@company.com</i>`;
        } else {
            const isAdmin = user.role === 'admin';
            const roleEmoji = isAdmin ? '👑 ADMIN' : '👔 Employee';

            message += `👤 ${user.full_name} | ${user.employee_id}\n`;
            message += `${roleEmoji}\n`;
            message += `━━━━━━━━━━━━━━━━━━\n\n`;

            message += `<b>⏰ Attendance:</b>\n`;
            message += `/checkin - Mark entry time\n`;
            message += `/checkout - Mark exit time\n`;
            message += `/mystatus - View today's status\n\n`;

            if (user.department === 'Calibration') {
                message += `<b>💰 Expenses (Calibration):</b>\n`;
                message += `/expense Type - Amount - Add expense\n`;
                message += `/expenses - View today's expenses\n`;
                message += `/submit - Submit for approval\n\n`;
            }

            message += `<b>🌴 Leave:</b>\n`;
            message += `/leave YYYY-MM-DD YYYY-MM-DD Reason\n`;
            message += `/myleaves - Check leave status\n\n`;

            if (isAdmin) {
                message += `<b>📊 Admin Reports:</b>\n`;
                message += `/summary - Today's attendance\n`;
                message += `/present - Present employees\n`;
                message += `/wfh - WFH employees\n`;
                message += `/stats - Quick statistics\n`;
                message += `/export - Generate Excel reports`;
            } else {
                message += `<i>📊 Reports are available for admins only.</i>`;
            }
        }

        await botInstance.sendMessage(chatId, message, { parse_mode: 'HTML' });

    } catch (error) {
        console.error('❌ Error in help command:', error);
        botInstance.sendMessage(chatId, '❌ An error occurred.');
    }
}

// Export all handlers
export default {
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
};
