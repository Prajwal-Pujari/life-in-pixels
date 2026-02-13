// ==================== TELEGRAM SCHEDULED JOBS ====================
// Scheduled notifications and reminders via Telegram

let dbPool = null;
let botInstance = null;

// Initialize with database pool and bot
export function initializeScheduledJobs(pool, bot) {
    dbPool = pool;
    botInstance = bot;
    console.log('✅ Scheduled jobs initialized');
}

/**
 * Send checkout reminder to users who haven't checked out
 * Called by cron job at configured time (default 6:30 PM)
 */
export async function sendCheckoutReminders() {
    if (!dbPool || !botInstance) {
        console.log('⚠️ Cannot send reminders: DB or bot not available');
        return;
    }

    try {
        const today = new Date().toISOString().split('T')[0];

        // Find users who have checked in but not checked out
        const result = await dbPool.query(
            `SELECT u.id, u.full_name, u.telegram_chat_id, a.work_hours_start
             FROM users u
             JOIN attendance a ON u.id = a.user_id
             WHERE a.date = $1 
               AND a.work_hours_start IS NOT NULL 
               AND a.work_hours_end IS NULL
               AND u.telegram_chat_id IS NOT NULL
               AND u.is_active = true`,
            [today]
        );

        if (result.rows.length === 0) {
            console.log('✅ No pending checkouts - all users checked out');
            return;
        }

        console.log(`📱 Sending checkout reminders to ${result.rows.length} users...`);

        for (const user of result.rows) {
            try {
                const checkInTime = new Date(`2000-01-01T${user.work_hours_start}`);
                const formattedTime = checkInTime.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                });

                await botInstance.sendMessage(user.telegram_chat_id,
                    `⏰ <b>Checkout Reminder</b>\n\n` +
                    `Hi ${user.full_name.split(' ')[0]}!\n\n` +
                    `You checked in at ${formattedTime} but haven't checked out yet.\n\n` +
                    `Reply with /checkout to mark your exit time.\n\n` +
                    `<i>This is an automated reminder.</i>`,
                    { parse_mode: 'HTML' }
                );

                console.log(`📤 Sent reminder to ${user.full_name}`);

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (err) {
                console.error(`❌ Failed to send reminder to ${user.full_name}:`, err.message);
            }
        }

        console.log(`✅ Checkout reminders sent to ${result.rows.length} users`);

    } catch (error) {
        console.error('❌ Error sending checkout reminders:', error);
    }
}

/**
 * Send leave approval/rejection notification to user
 */
export async function sendLeaveStatusNotification(userId, status, startDate, endDate, reason = null) {
    if (!dbPool || !botInstance) return;

    try {
        // Get user's telegram chat ID
        const userResult = await dbPool.query(
            'SELECT full_name, telegram_chat_id FROM users WHERE id = $1 AND telegram_chat_id IS NOT NULL',
            [userId]
        );

        if (userResult.rows.length === 0) return;

        const user = userResult.rows[0];
        const start = new Date(startDate);
        const end = new Date(endDate);

        const formatDate = (d) => d.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });

        let message;
        if (status === 'approved') {
            message = `✅ <b>Leave Approved!</b>\n\n` +
                `📅 ${formatDate(start)} - ${formatDate(end)}\n\n` +
                `Your leave request has been approved. Enjoy your time off! 🎉`;
        } else if (status === 'rejected') {
            message = `❌ <b>Leave Request Rejected</b>\n\n` +
                `📅 ${formatDate(start)} - ${formatDate(end)}\n\n`;
            if (reason) {
                message += `Reason: ${reason}\n\n`;
            }
            message += `Please contact your manager for more details.`;
        }

        await botInstance.sendMessage(user.telegram_chat_id, message, { parse_mode: 'HTML' });
        console.log(`📤 Leave ${status} notification sent to ${user.full_name}`);

    } catch (error) {
        console.error('❌ Error sending leave notification:', error);
    }
}

/**
 * Send expense approval notification to user
 */
export async function sendExpenseApprovalNotification(userId, location, amount, isApproved, reason = null) {
    if (!dbPool || !botInstance) return;

    try {
        const userResult = await dbPool.query(
            'SELECT full_name, telegram_chat_id FROM users WHERE id = $1 AND telegram_chat_id IS NOT NULL',
            [userId]
        );

        if (userResult.rows.length === 0) return;

        const user = userResult.rows[0];

        let message;
        if (isApproved) {
            message = `✅ <b>Expenses Approved!</b>\n\n` +
                `📍 ${location}\n` +
                `💰 ₹${parseFloat(amount).toFixed(2)}\n\n` +
                `Your expenses have been approved for reimbursement! 🎉`;
        } else {
            message = `❌ <b>Expenses Rejected</b>\n\n` +
                `📍 ${location}\n` +
                `💰 ₹${parseFloat(amount).toFixed(2)}\n\n`;
            if (reason) {
                message += `Reason: ${reason}\n\n`;
            }
            message += `Please contact admin for more details.`;
        }

        await botInstance.sendMessage(user.telegram_chat_id, message, { parse_mode: 'HTML' });
        console.log(`📤 Expense ${isApproved ? 'approval' : 'rejection'} notification sent to ${user.full_name}`);

    } catch (error) {
        console.error('❌ Error sending expense notification:', error);
    }
}

/**
 * Send work anniversary notifications
 * Called by cron job at 9:00 AM daily to celebrate anniversaries
 */
export async function sendAnniversaryNotifications() {
    if (!dbPool || !botInstance) {
        console.log('⚠️ Cannot send anniversary notifications: DB or bot not available');
        return;
    }

    try {
        // Get today's anniversaries
        const result = await dbPool.query('SELECT * FROM get_todays_anniversaries()');

        if (result.rows.length === 0) {
            console.log('🎂 No work anniversaries today');
            return;
        }

        console.log(`🎂 Found ${result.rows.length} work anniversaries today!`);

        // Get admin chat ID for group notification
        const adminChatId = process.env.TELEGRAM_CHAT_ID;

        for (const employee of result.rows) {
            try {
                const years = employee.years_completed;
                const firstName = employee.full_name.split(' ')[0];
                const joiningDate = new Date(employee.joining_date).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                });

                // Send message to employee
                if (employee.telegram_chat_id) {
                    const employeeMessage =
                        `🎉🎊 <b>Happy Work Anniversary!</b> 🎊🎉\n\n` +
                        `━━━━━━━━━━━━━━━━━━\n` +
                        `🌟 Congratulations, ${firstName}!\n\n` +
                        `You've been with us for <b>${years} ${years === 1 ? 'year' : 'years'}</b> today!\n\n` +
                        `📅 Joined: ${joiningDate}\n` +
                        `━━━━━━━━━━━━━━━━━━\n\n` +
                        `Thank you for your dedication and hard work. ` +
                        `Here's to many more years together! 🚀\n\n` +
                        `<i>From the entire team 💙</i>`;

                    await botInstance.sendMessage(employee.telegram_chat_id, employeeMessage, { parse_mode: 'HTML' });
                    console.log(`🎂 Anniversary message sent to ${employee.full_name}`);
                }

                // Send message to admin channel
                if (adminChatId) {
                    const adminMessage =
                        `🎂 <b>Work Anniversary Alert!</b>\n\n` +
                        `👤 <b>${employee.full_name}</b>\n` +
                        `🆔 ${employee.employee_id}\n` +
                        `🏢 ${employee.department || 'N/A'}\n\n` +
                        `🌟 Completes <b>${years} ${years === 1 ? 'year' : 'years'}</b> today!\n` +
                        `📅 Joined: ${joiningDate}\n\n` +
                        `<i>🎉 Don't forget to wish them!</i>`;

                    await botInstance.sendMessage(adminChatId, adminMessage, { parse_mode: 'HTML' });
                }

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (err) {
                console.error(`❌ Failed to send anniversary notification for ${employee.full_name}:`, err.message);
            }
        }

        console.log(`✅ Anniversary notifications sent for ${result.rows.length} employees`);

    } catch (error) {
        console.error('❌ Error sending anniversary notifications:', error);
    }
}

/**
 * Cleanup expired verification codes
 * Should be run periodically (e.g., every hour)
 */
export async function cleanupExpiredCodes() {
    if (!dbPool) return;

    try {
        const result = await dbPool.query('SELECT cleanup_expired_verification_codes()');
        const deletedCount = result.rows[0].cleanup_expired_verification_codes;
        if (deletedCount > 0) {
            console.log(`🧹 Cleaned up ${deletedCount} expired verification codes`);
        }
    } catch (error) {
        console.error('❌ Error cleaning up verification codes:', error);
    }
}

export default {
    initializeScheduledJobs,
    sendCheckoutReminders,
    sendLeaveStatusNotification,
    sendExpenseApprovalNotification,
    sendAnniversaryNotifications,
    cleanupExpiredCodes
};
