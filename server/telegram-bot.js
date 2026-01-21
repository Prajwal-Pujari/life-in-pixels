// Telegram Bot Integration for Attendance Reports
import TelegramBot from 'node-telegram-bot-api';
import { setupCommandHandlers } from './telegram-commands.js';

let bot = null;

// Initialize Telegram Bot
export function initializeTelegramBot() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const enabled = process.env.TELEGRAM_ENABLED === 'true';

    if (!enabled) {
        console.log('📱 Telegram bot is disabled');
        return null;
    }

    if (!token) {
        console.error('⚠️ TELEGRAM_BOT_TOKEN not set in .env file');
        return null;
    }

    try {
        // Create bot instance with polling enabled for interactive commands
        bot = new TelegramBot(token, { polling: true });

        // Set up command handlers
        setupCommandHandlers(bot);

        console.log('✅ Telegram bot initialized successfully');
        console.log('📱 Bot is listening for commands...');
        return bot;
    } catch (error) {
        console.error('❌ Error initializing Telegram bot:', error.message);
        return null;
    }
}

// Send message to Telegram
export async function sendTelegramMessage(message) {
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!bot) {
        throw new Error('Telegram bot not initialized');
    }

    if (!chatId) {
        throw new Error('TELEGRAM_CHAT_ID not set in .env file');
    }

    try {
        const result = await bot.sendMessage(chatId, message, {
            parse_mode: 'HTML',
            disable_web_page_preview: true
        });
        console.log('✅ Telegram message sent successfully');
        return result;
    } catch (error) {
        console.error('❌ Error sending Telegram message:', error.message);
        throw error;
    }
}

// Format time for display
function formatTime(timeString) {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

// Calculate hours between two times
function calculateHours(startTime, endTime) {
    if (!startTime || !endTime) return null;

    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    const diffMinutes = endMinutes - startMinutes;
    const hours = (diffMinutes / 60).toFixed(1);

    return hours;
}

// Format attendance status for display
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

function getStatusLabel(status) {
    const labelMap = {
        'present': 'PRESENT',
        'absent': 'ABSENT',
        'wfh': 'WORK FROM HOME',
        'half_day': 'HALF DAY',
        'on_leave': 'ON LEAVE',
        'leave': 'ON LEAVE'
    };
    return labelMap[status] || status.toUpperCase();
}

// Generate attendance report
export function generateAttendanceReport(attendanceData, date) {
    const reportDate = new Date(date);
    const formattedDate = reportDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Group employees by status
    const grouped = {
        present: [],
        wfh: [],
        half_day: [],
        on_leave: [],
        absent: [],
        not_marked: []
    };

    let totalEmployees = 0;

    attendanceData.forEach(emp => {
        totalEmployees++;
        const status = emp.status || 'not_marked';

        // Normalize status
        const normalizedStatus = status === 'leave' ? 'on_leave' : status;

        if (grouped[normalizedStatus]) {
            grouped[normalizedStatus].push(emp);
        } else {
            grouped.not_marked.push(emp);
        }
    });

    // Calculate stats
    const stats = {
        total: totalEmployees,
        present: grouped.present.length,
        wfh: grouped.wfh.length,
        half_day: grouped.half_day.length,
        on_leave: grouped.on_leave.length,
        absent: grouped.absent.length,
        not_marked: grouped.not_marked.length
    };

    const markedCount = stats.total - stats.not_marked;
    const attendanceRate = stats.total > 0
        ? ((markedCount / stats.total) * 100).toFixed(1)
        : 0;

    // Build message
    let message = `🎯 <b>ATTENDANCE REPORT</b>\n`;
    message += `📅 Date: ${formattedDate}\n\n`;

    // Summary
    message += `📊 <b>SUMMARY:</b>\n`;
    message += `━━━━━━━━━━━━━━━━━━\n`;
    if (stats.present > 0) {
        message += `✅ Present: ${stats.present} employees (${((stats.present / stats.total) * 100).toFixed(1)}%)\n`;
    }
    if (stats.wfh > 0) {
        message += `🏠 Work From Home: ${stats.wfh} employees (${((stats.wfh / stats.total) * 100).toFixed(1)}%)\n`;
    }
    if (stats.half_day > 0) {
        message += `⏰ Half Day: ${stats.half_day} employees (${((stats.half_day / stats.total) * 100).toFixed(1)}%)\n`;
    }
    if (stats.on_leave > 0) {
        message += `🌴 On Leave: ${stats.on_leave} employees (${((stats.on_leave / stats.total) * 100).toFixed(1)}%)\n`;
    }
    if (stats.absent > 0) {
        message += `❌ Absent: ${stats.absent} employees (${((stats.absent / stats.total) * 100).toFixed(1)}%)\n`;
    }
    message += `━━━━━━━━━━━━━━━━━━\n`;
    message += `Total: ${stats.total} employees\n`;
    message += `Attendance Rate: ${attendanceRate}%\n\n`;

    // Format employee sections
    const sections = [
        { key: 'present', label: 'PRESENT', emoji: '✅' },
        { key: 'wfh', label: 'WORK FROM HOME', emoji: '🏠' },
        { key: 'half_day', label: 'HALF DAY', emoji: '⏰' },
        { key: 'on_leave', label: 'ON LEAVE', emoji: '🌴' },
        { key: 'absent', label: 'ABSENT', emoji: '❌' },
        { key: 'not_marked', label: 'NOT MARKED', emoji: '⚠️' }
    ];

    sections.forEach(section => {
        const employees = grouped[section.key];
        if (employees.length === 0) return;

        message += `${section.emoji} <b>${section.label} (${employees.length}):</b>\n`;
        message += `━━━━━━━━━━━━━━━━━━\n`;

        employees.forEach(emp => {
            message += `• ${emp.full_name} (${emp.employee_id})`;

            if (emp.department) {
                message += ` - ${emp.department}`;
            }
            message += `\n`;

            // Add work hours if available
            if (emp.work_hours_start && emp.work_hours_end) {
                const hours = calculateHours(emp.work_hours_start, emp.work_hours_end);
                message += `  ⏰ ${formatTime(emp.work_hours_start)} → ${formatTime(emp.work_hours_end)}`;
                if (hours) {
                    message += ` (${hours} hrs)`;
                }
                message += `\n`;
            }

            // Add notes if available
            if (emp.notes && emp.notes.trim()) {
                const truncatedNotes = emp.notes.length > 100
                    ? emp.notes.substring(0, 97) + '...'
                    : emp.notes;
                message += `  📝 ${truncatedNotes}\n`;
            }

            message += `\n`;
        });
    });

    // Footer
    const now = new Date();
    const timestamp = now.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
    message += `<i>Generated: ${timestamp}</i>`;

    return { message, stats };
}

export { bot };
