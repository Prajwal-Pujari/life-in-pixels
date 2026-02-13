import express from 'express';
import pg from 'pg';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import passport from './auth.js';
import { generateToken, initializePassport } from './auth.js';
import {
    canMarkAttendance,
    getAttendance,
    markAttendance,
    deleteAttendance,
    getAttendanceSummary
} from './attendance.js';
import {
    isApproved,
    getPendingUsers,
    approveUser,
    rejectUser
} from './user-approval.js';
import { initializeTelegramBot } from './telegram-bot.js';
import { sendDailyAttendanceReport, getAttendanceReportPreview } from './telegram-reports.js';
import cron from 'node-cron';
import {
    exportIndividualReport,
    exportBulkReport,
    exportMonthlySummary,
    exportStatisticsReport,
    exportPayrollReport,
    exportCustomReport
} from './exports/export-routes.js';
import {
    isCalibrationDept,
    createSiteVisit,
    getSiteVisitByDate,
    updateSiteVisit,
    addExpense,
    updateExpense,
    deleteExpense,
    submitForApproval,
    getAutocompleteSuggestions,
    getPendingApprovals,
    getExpenseHistory,
    approveExpense,
    rejectExpense
} from './calibration-routes.js';
import { setupTaskRoutes, processTaskReminders } from './task-routes.js';

dotenv.config();

const { Pool } = pg;
const app = express();

// Establish database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Make pool available globally for auth.js
global.pool = pool;

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Database connection error:', err);
        process.exit(1);
    } else {
        console.log('✅ Database connected successfully at:', res.rows[0].now);
    }
});

// Security: Enforce JWT_SECRET
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('❌ FATAL: JWT_SECRET environment variable is required');
    console.error('   Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
    process.exit(1);
}

// Initialize Google OAuth (MUST be called after dotenv.config())
initializePassport();

// ==================== MIDDLEWARE ====================

// CORS configuration - supports multiple origins for local network development
const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
];

// Add local network IPs dynamically
const localIP = process.env.LOCAL_IP;
if (localIP) {
    allowedOrigins.push(`http://${localIP}:3000`);
}

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, Postman)
        if (!origin) return callback(null, true);

        // Check if origin is in allowed list or matches local network pattern
        if (allowedOrigins.includes(origin) || /^http:\/\/192\.168\.\d+\.\d+:\d+$/.test(origin)) {
            callback(null, true);
        } else {
            console.log('⚠️ CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Session configuration (required for Passport)
app.use(session({
    secret: process.env.SESSION_SECRET || JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Initialize Passport strategies and Telegram bot
initializePassport();
initializeTelegramBot();

// Initialize Telegram commands with database pool (after connection)
const { initializeTelegramCommands } = await import('./telegram-commands.js');
await initializeTelegramCommands(pool);

// Initialize scheduled jobs for Telegram
const { initializeScheduledJobs, sendCheckoutReminders, cleanupExpiredCodes, sendAnniversaryNotifications } = await import('./telegram-scheduled-jobs.js');
const { bot } = await import('./telegram-bot.js');
initializeScheduledJobs(pool, bot);

// Schedule daily Telegram report at 7:00 PM (19:00)
if (process.env.TELEGRAM_ENABLED === 'true') {
    cron.schedule('0 19 * * *', async () => {
        console.log('⏰ Sending scheduled daily attendance report...');
        try {
            const mockReq = { user: { id: 1 }, body: {} };
            const mockRes = {
                json: (data) => console.log('✅ Scheduled report sent:', data.message),
                status: (code) => ({ json: (data) => console.error('❌ Scheduled report failed:', data.error) })
            };
            await sendDailyAttendanceReport(mockReq, mockRes, pool);
        } catch (error) {
            console.error('❌ Failed to send scheduled report:', error.message);
        }
    }, {
        timezone: 'Asia/Kolkata' // Indian Standard Time
    });
    console.log('✅ Scheduled daily report at 7:00 PM IST');

    // Schedule checkout reminder at 6:30 PM
    const reminderTime = process.env.TELEGRAM_CHECKOUT_REMINDER_TIME || '18:30';
    const [reminderHour, reminderMinute] = reminderTime.split(':').map(Number);
    cron.schedule(`${reminderMinute} ${reminderHour} * * 1-5`, async () => {
        console.log('⏰ Sending checkout reminders...');
        await sendCheckoutReminders();
    }, {
        timezone: 'Asia/Kolkata'
    });
    console.log(`✅ Scheduled checkout reminders at ${reminderTime} IST (weekdays)`);

    // Schedule work anniversary notifications at 9:00 AM daily
    cron.schedule('0 9 * * *', async () => {
        console.log('🎂 Checking for work anniversaries...');
        await sendAnniversaryNotifications();
    }, {
        timezone: 'Asia/Kolkata'
    });
    console.log('✅ Scheduled anniversary notifications at 9:00 AM IST');

    // Schedule cleanup of expired verification codes every hour
    cron.schedule('0 * * * *', async () => {
        await cleanupExpiredCodes();
    }, {
        timezone: 'Asia/Kolkata'
    });

    // Schedule task reminders every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
        console.log('⏰ Processing task reminders...');
        await processTaskReminders(pool, bot);
    }, {
        timezone: 'Asia/Kolkata'
    });
    console.log('✅ Scheduled task reminders every 15 minutes');
}

// Rate limiters
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many authentication attempts, please try again later' }
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500, // Increased from 100 to support task management operations
    message: { error: 'Too many requests, please try again later' }
});

app.use('/api', apiLimiter);

// JWT authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Admin check middleware
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// ==================== GOOGLE OAUTH ROUTES ====================

// Initiate Google OAuth login
app.get('/api/auth/google',
    authLimiter,
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google OAuth callback
app.get('/api/auth/google/callback',
    authLimiter,
    passport.authenticate('google', { failureRedirect: '/login?error=auth_failed' }),
    (req, res) => {
        // Generate JWT token
        const token = generateToken(req.user);

        // Redirect to frontend with token
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
    }
);

// Logout
app.post('/api/auth/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        req.session.destroy();
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

// Get current user info
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, username, email, full_name, role, employee_id, department, avatar_url,
              created_at, last_login 
       FROM users WHERE id = $1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.full_name,
            role: user.role,
            employeeId: user.employee_id,
            department: user.department,
            avatarUrl: user.avatar_url,
            createdAt: user.created_at,
            lastLogin: user.last_login
        });
    } catch (error) {
        console.error('❌ Error fetching user:', error);
        res.status(500).json({ error: 'Failed to fetch user info' });
    }
});

// ==================== EMPLOYEE ROUTES ====================

// Get all employees (admin only)
app.get('/api/admin/employees', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, username, email, full_name, role, employee_id, department, 
              is_active, created_at, last_login, avatar_url
       FROM users 
       WHERE role = 'employee' 
       ORDER BY full_name`
        );

        res.json(result.rows);
    } catch (error) {
        console.error('❌ Error fetching employees:', error);
        res.status(500).json({ error: 'Failed to fetch employees' });
    }
});

// ==================== USER MANAGEMENT ROUTES (ADMIN ONLY) ====================

// Get all users (admin only)
app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, username, email, full_name, role, employee_id, department, 
              is_active, created_at, last_login, avatar_url, google_id, joining_date, telegram_chat_id
       FROM users 
       ORDER BY created_at DESC`
        );

        const users = result.rows.map(user => ({
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.full_name,
            role: user.role,
            employeeId: user.employee_id,
            department: user.department,
            isActive: user.is_active,
            createdAt: user.created_at,
            lastLogin: user.last_login,
            avatarUrl: user.avatar_url,
            authMethod: user.google_id ? 'google' : 'password',
            joiningDate: user.joining_date,
            telegramId: user.telegram_chat_id
        }));

        res.json(users);
    } catch (error) {
        console.error('❌ Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get all users for exports (simplified response, admin only)
app.get('/api/admin/all-users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, full_name, employee_id, department, email, role, is_active
             FROM users
             WHERE is_approved = true AND role IS NOT NULL
             ORDER BY full_name ASC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching all users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Create new user (admin only)
app.post('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { username, password, email, fullName, role, employeeId, department } = req.body;

        // Validation
        if (!username || !password || !email || !fullName || !employeeId) {
            return res.status(400).json({
                error: 'Username, password, email, full name, and employee ID are required'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Check if username or email already exists
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE username = $1 OR email = $2',
            [username, email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'Username or email already exists' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user
        const result = await pool.query(
            `INSERT INTO users (
        username, password_hash, email, full_name, role, employee_id, department, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      RETURNING id, username, email, full_name, role, employee_id, department, is_active, created_at`,
            [username, passwordHash, email, fullName, role || 'employee', employeeId, department || null]
        );

        const newUser = result.rows[0];

        // Log activity
        await pool.query(
            'INSERT INTO activity_log (user_id, action_type, action_details) VALUES ($1, $2, $3)',
            [req.user.id, 'create_user', `Created user ${username} (${fullName})`]
        );

        console.log(`✅ Admin ${req.user.username} created new user: ${username}`);

        res.status(201).json({
            id: newUser.id,
            username: newUser.username,
            email: newUser.email,
            fullName: newUser.full_name,
            role: newUser.role,
            employeeId: newUser.employee_id,
            department: newUser.department,
            isActive: newUser.is_active,
            createdAt: newUser.created_at
        });
    } catch (error) {
        console.error('❌ Error creating user:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Deactivate user (admin only)
app.put('/api/admin/users/:id/deactivate', authenticateToken, isAdmin, async (req, res) => {
    try {
        const userId = req.params.id;

        // Prevent self-deactivation
        if (parseInt(userId) === req.user.id) {
            return res.status(400).json({ error: 'Cannot deactivate your own account' });
        }

        // Get user info before deactivating
        const userResult = await pool.query('SELECT username, full_name FROM users WHERE id = $1', [userId]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];

        // Deactivate user
        await pool.query('UPDATE users SET is_active = false WHERE id = $1', [userId]);

        // Log activity
        await pool.query(
            'INSERT INTO activity_log (user_id, action_type, action_details) VALUES ($1, $2, $3)',
            [req.user.id, 'deactivate_user', `Deactivated user ${user.username} (${user.full_name})`]
        );

        console.log(`⚠️ Admin ${req.user.username} deactivated user: ${user.username}`);

        res.json({ success: true, message: 'User deactivated successfully' });
    } catch (error) {
        console.error('❌ Error deactivating user:', error);
        res.status(500).json({ error: 'Failed to deactivate user' });
    }
});

// Reactivate user (admin only)
app.put('/api/admin/users/:id/activate', authenticateToken, isAdmin, async (req, res) => {
    try {
        const userId = req.params.id;

        const userResult = await pool.query('SELECT username, full_name FROM users WHERE id = $1', [userId]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];

        // Reactivate user
        await pool.query('UPDATE users SET is_active = true WHERE id = $1', [userId]);

        // Log activity
        await pool.query(
            'INSERT INTO activity_log (user_id, action_type, action_details) VALUES ($1, $2, $3)',
            [req.user.id, 'activate_user', `Reactivated user ${user.username} (${user.full_name})`]
        );

        console.log(`✅ Admin ${req.user.username} reactivated user: ${user.username}`);

        res.json({ success: true, message: 'User reactivated successfully' });
    } catch (error) {
        console.error('❌ Error reactivating user:', error);
        res.status(500).json({ error: 'Failed to reactivate user' });
    }
});

// Update user's Telegram ID (admin only)
app.put('/api/admin/users/:id/telegram', authenticateToken, isAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const { telegramId } = req.body;

        // Validate telegram_id
        if (telegramId && (!Number.isInteger(telegramId) || telegramId <= 0)) {
            return res.status(400).json({ error: 'Invalid Telegram ID' });
        }

        // Check if telegram_id is already in use
        if (telegramId) {
            const existing = await pool.query(
                'SELECT id, full_name FROM users WHERE telegram_id = $1 AND id != $2',
                [telegramId, userId]
            );

            if (existing.rows.length > 0) {
                return res.status(409).json({
                    error: `Telegram ID already linked to ${existing.rows[0].full_name}`
                });
            }
        }

        // Update telegram_id
        await pool.query(
            'UPDATE users SET telegram_id = $1 WHERE id = $2',
            [telegramId || null, userId]
        );

        // Log activity
        const userResult = await pool.query('SELECT full_name FROM users WHERE id = $1', [userId]);
        await pool.query(
            'INSERT INTO activity_log (user_id, action_type, action_details) VALUES ($1, $2, $3)',
            [req.user.id, 'update_telegram', `Updated Telegram ID for ${userResult.rows[0].full_name}`]
        );

        console.log(`✅ Admin ${req.user.username} updated Telegram ID for user ${userId}`);

        res.json({ success: true, message: 'Telegram ID updated successfully' });
    } catch (error) {
        console.error('❌ Error updating Telegram ID:', error);
        res.status(500).json({ error: 'Failed to update Telegram ID' });
    }
});

// Update user's department (admin only)
app.put('/api/admin/users/:id/department', authenticateToken, isAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const { department } = req.body;

        // Get user info before updating
        const userResult = await pool.query('SELECT full_name, department as old_department FROM users WHERE id = $1', [userId]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];

        // Update department
        await pool.query(
            'UPDATE users SET department = $1 WHERE id = $2',
            [department || null, userId]
        );

        // Log activity
        await pool.query(
            'INSERT INTO activity_log (user_id, action_type, action_details) VALUES ($1, $2, $3)',
            [req.user.id, 'update_department', `Updated ${user.full_name}'s department from "${user.old_department || 'none'}" to "${department || 'none'}"`]
        );

        console.log(`✅ Admin ${req.user.username} updated department for ${user.full_name}: ${user.old_department || 'none'} → ${department || 'none'}`);

        res.json({ success: true, message: 'Department updated successfully' });
    } catch (error) {
        console.error('❌ Error updating department:', error);
        res.status(500).json({ error: 'Failed to update department' });
    }
});

// ==================== ATTENDANCE ROUTES ====================

// Get attendance records
app.get('/api/attendance', authenticateToken, (req, res) => getAttendance(req, res, pool));

// Mark/update attendance with permission check
app.post('/api/attendance', authenticateToken, canMarkAttendance, (req, res) => markAttendance(req, res, pool));

// Delete attendance (admin only)
app.delete('/api/attendance/:id', authenticateToken, isAdmin, (req, res) => deleteAttendance(req, res, pool));

// Get attendance summary
app.get('/api/attendance/summary', authenticateToken, (req, res) => getAttendanceSummary(req, res, pool));

// ==================== USER APPROVAL ROUTES (ADMIN ONLY) ====================

// Get pending users
app.get('/api/admin/pending-users', authenticateToken, isAdmin, (req, res) => getPendingUsers(req, res, pool));

// Approve user
app.post('/api/admin/approve-user', authenticateToken, isAdmin, (req, res) => approveUser(req, res, pool));

// Reject user
app.delete('/api/admin/reject-user/:id', authenticateToken, isAdmin, (req, res) => rejectUser(req, res, pool));

// ==================== TELEGRAM REPORTS (ADMIN ONLY) ====================

// Send attendance report to Telegram
app.post('/api/admin/telegram-report', authenticateToken, isAdmin, (req, res) => sendDailyAttendanceReport(req, res, pool));

// Get report preview without sending
app.get('/api/admin/telegram-report/preview', authenticateToken, isAdmin, (req, res) => getAttendanceReportPreview(req, res, pool));

// ==================== EXCEL EXPORT ROUTES (ADMIN ONLY) ====================

// Individual employee report
app.post('/api/admin/export/individual', authenticateToken, isAdmin, (req, res) => exportIndividualReport(req, res, pool));

// Bulk employee report
app.post('/api/admin/export/bulk', authenticateToken, isAdmin, (req, res) => exportBulkReport(req, res, pool));

// Monthly summary report
app.post('/api/admin/export/monthly-summary', authenticateToken, isAdmin, (req, res) => exportMonthlySummary(req, res, pool));

// Statistics report
app.post('/api/admin/export/statistics', authenticateToken, isAdmin, (req, res) => exportStatisticsReport(req, res, pool));

// Payroll report
app.post('/api/admin/export/payroll', authenticateToken, isAdmin, (req, res) => exportPayrollReport(req, res, pool));

// Custom date range report
app.post('/api/admin/export/custom', authenticateToken, isAdmin, (req, res) => exportCustomReport(req, res, pool));

// ==================== CALIBRATION EXPENSE ROUTES ====================

// Employee routes (Calibration department only)
app.post('/api/calibration/site-visit', authenticateToken, isCalibrationDept, (req, res) => createSiteVisit(req, res, pool));
app.get('/api/calibration/site-visit/:date', authenticateToken, isCalibrationDept, (req, res) => getSiteVisitByDate(req, res, pool));
app.put('/api/calibration/site-visit/:id', authenticateToken, isCalibrationDept, (req, res) => updateSiteVisit(req, res, pool));
app.post('/api/calibration/site-visit/:id/expenses', authenticateToken, isCalibrationDept, (req, res) => addExpense(req, res, pool));
app.put('/api/calibration/expenses/:id', authenticateToken, isCalibrationDept, (req, res) => updateExpense(req, res, pool));
app.delete('/api/calibration/expenses/:id', authenticateToken, isCalibrationDept, (req, res) => deleteExpense(req, res, pool));
app.post('/api/calibration/site-visit/:id/submit', authenticateToken, isCalibrationDept, (req, res) => submitForApproval(req, res, pool));
app.get('/api/calibration/autocomplete', authenticateToken, isCalibrationDept, (req, res) => getAutocompleteSuggestions(req, res, pool));

// Admin routes
app.get('/api/admin/calibration/pending', authenticateToken, isAdmin, (req, res) => getPendingApprovals(req, res, pool));
app.get('/api/admin/calibration/history', authenticateToken, isAdmin, (req, res) => getExpenseHistory(req, res, pool));
app.put('/api/admin/calibration/approve/:id', authenticateToken, isAdmin, (req, res) => approveExpense(req, res, pool));
app.put('/api/admin/calibration/reject/:id', authenticateToken, isAdmin, (req, res) => rejectExpense(req, res, pool));

// ==================== SALARY & PAYMENT TRACKING ROUTES ====================

import salaryRouter, { setSalaryPool } from './salary-routes.js';
setSalaryPool(pool);
app.use('/api/salary', authenticateToken, salaryRouter);

// ==================== TASK MANAGEMENT ROUTES ====================

// Initialize task routes with pool, middleware, and telegram bot
setupTaskRoutes(app, pool, authenticateToken, isAdmin, bot);


// ==================== JOURNAL/WORK LOGS ROUTES ====================

// Get entries (employees see their own, admins can see anyone's)
app.get('/api/entries', authenticateToken, async (req, res) => {
    try {
        const userId = req.query.userId || req.user.id;

        // Only admins can view other users' entries
        if (userId != req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await pool.query(
            `SELECT 
        entry_date, task_summary, work_status, morning, work, moments, 
        thoughts, gratitude, end_of_day, study_start_time, study_end_time, 
        study_subject, study_notes, created_at, updated_at 
      FROM work_logs 
      WHERE user_id = $1
      ORDER BY entry_date DESC`,
            [userId]
        );

        const entries = {};
        result.rows.forEach(row => {
            const date = new Date(row.entry_date);
            const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

            entries[key] = {
                oneSentence: row.task_summary || '',
                mood: row.work_status || '',
                morning: row.morning || '',
                work: row.work || '',
                moments: row.moments || '',
                thoughts: row.thoughts || '',
                gratitude: row.gratitude || '',
                endOfDay: row.end_of_day || '',
                studyStartTime: row.study_start_time || '',
                studyEndTime: row.study_end_time || '',
                studySubject: row.study_subject || '',
                studyNotes: row.study_notes || ''
            };
        });

        res.json(entries);
    } catch (error) {
        console.error('❌ Error fetching entries:', error);
        res.status(500).json({ error: 'Failed to fetch entries' });
    }
});

// Save entry
app.post('/api/entries', authenticateToken, async (req, res) => {
    try {
        const { year, month, day, entry } = req.body;
        const userId = req.user.id;

        const entryDate = new Date(year, month, day);

        const result = await pool.query(
            `INSERT INTO work_logs (
        user_id, entry_date, task_summary, work_status, morning, work, 
        moments, thoughts, gratitude, end_of_day,
        study_start_time, study_end_time, study_subject, study_notes,
        updated_at
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, entry_date) 
       DO UPDATE SET 
         task_summary = $3, work_status = $4, morning = $5, work = $6,
         moments = $7, thoughts = $8, gratitude = $9, end_of_day = $10,
         study_start_time = $11, study_end_time = $12, 
         study_subject = $13, study_notes = $14,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
            [
                userId, entryDate,
                entry.oneSentence || null, entry.mood || null,
                entry.morning || null, entry.work || null,
                entry.moments || null, entry.thoughts || null,
                entry.gratitude || null, entry.endOfDay || null,
                entry.studyStartTime || null, entry.studyEndTime || null,
                entry.studySubject || null, entry.studyNotes || null
            ]
        );

        // Log activity
        await pool.query(
            'INSERT INTO activity_log (user_id, action_type, action_details) VALUES ($1, $2, $3)',
            [userId, 'work_log', `Updated work log for ${entryDate.toDateString()}`]
        );

        res.json({ success: true, entry: result.rows[0] });
    } catch (error) {
        console.error('❌ Error saving entry:', error);
        res.status(500).json({ error: 'Failed to save entry' });
    }
});

// Delete entry
app.delete('/api/entries/:year/:month/:day', authenticateToken, async (req, res) => {
    try {
        const { year, month, day } = req.params;
        const userId = req.user.id;
        const entryDate = new Date(parseInt(year), parseInt(month), parseInt(day));

        await pool.query(
            'DELETE FROM work_logs WHERE user_id = $1 AND entry_date = $2',
            [userId, entryDate]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error deleting entry:', error);
        res.status(500).json({ error: 'Failed to delete entry' });
    }
});

// ==================== HOLIDAYS ROUTES ====================

// Get holidays
app.get('/api/holidays', authenticateToken, async (req, res) => {
    try {
        const { year } = req.query;

        let query = 'SELECT * FROM holidays';
        let params = [];

        if (year) {
            query += ' WHERE EXTRACT(YEAR FROM holiday_date) = $1';
            params.push(year);
        }

        query += ' ORDER BY holiday_date';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('❌ Error fetching holidays:', error);
        res.status(500).json({ error: 'Failed to fetch holidays' });
    }
});

// Add holiday (admin only)
app.post('/api/admin/holidays', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { holidayName, holidayDate, description, isRecurring } = req.body;

        const result = await pool.query(
            `INSERT INTO holidays (holiday_name, holiday_date, description, is_recurring, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
            [holidayName, holidayDate, description, isRecurring, req.user.id]
        );

        // Log activity
        await pool.query(
            'INSERT INTO activity_log (user_id, action_type, action_details) VALUES ($1, $2, $3)',
            [req.user.id, 'add_holiday', `Added holiday: ${holidayName}`]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('❌ Error adding holiday:', error);
        res.status(500).json({ error: 'Failed to add holiday' });
    }
});

// Delete holiday (admin only)
app.delete('/api/admin/holidays/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM holidays WHERE id = $1', [req.params.id]);

        // Log activity
        await pool.query(
            'INSERT INTO activity_log (user_id, action_type, action_details) VALUES ($1, $2, $3)',
            [req.user.id, 'delete_holiday', `Deleted holiday ID: ${req.params.id}`]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error deleting holiday:', error);
        res.status(500).json({ error: 'Failed to delete holiday' });
    }
});

// ==================== ADMIN DASHBOARD ====================

// Get dashboard stats
app.get('/api/admin/dashboard', authenticateToken, isAdmin, async (req, res) => {
    try {
        const stats = await pool.query('SELECT * FROM admin_dashboard_stats');
        res.json(stats.rows[0]);
    } catch (error) {
        console.error('❌ Error fetching dashboard stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Get activity log
app.get('/api/admin/activity-log', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { limit = 50, userId } = req.query;

        let query = `
      SELECT al.*, u.full_name, u.username
      FROM activity_log al
      JOIN users u ON al.user_id = u.id
    `;
        let params = [];

        if (userId) {
            query += ' WHERE al.user_id = $1';
            params.push(userId);
        }

        query += ' ORDER BY al.created_at DESC LIMIT $' + (params.length + 1);
        params.push(limit);

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('❌ Error fetching activity log:', error);
        res.status(500).json({ error: 'Failed to fetch activity log' });
    }
});

// Get monthly summary (with user parameter for admin)
app.get('/api/monthly-summary/:year/:month', authenticateToken, async (req, res) => {
    try {
        const { year, month } = req.params;
        const userId = req.query.userId || req.user.id;

        // Only admins can view other users' summaries
        if (userId != req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const stats = await pool.query(
            `SELECT 
        COUNT(*) as total_entries,
        COALESCE(SUM(
          CASE 
            WHEN study_start_time IS NOT NULL AND study_end_time IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (study_end_time - study_start_time)) / 3600 
            ELSE 0 
          END
        ), 0) as total_study_hours,
        mode() WITHIN GROUP (ORDER BY work_status) FILTER (WHERE work_status IS NOT NULL) as most_common_mood,
        COUNT(CASE WHEN gratitude IS NOT NULL AND gratitude != '' THEN 1 END) as gratitude_count,
        array_agg(DISTINCT study_subject) FILTER (WHERE study_subject IS NOT NULL AND study_subject != '') as study_subjects
      FROM work_logs
      WHERE user_id = $1 
        AND EXTRACT(YEAR FROM entry_date) = $2 
        AND EXTRACT(MONTH FROM entry_date) = $3`,
            [userId, year, parseInt(month) + 1]
        );

        const entries = await pool.query(
            `SELECT entry_date, task_summary, work_status, moments, study_subject, gratitude
       FROM work_logs
       WHERE user_id = $1 
         AND EXTRACT(YEAR FROM entry_date) = $2 
         AND EXTRACT(MONTH FROM entry_date) = $3
       ORDER BY entry_date ASC`,
            [userId, year, parseInt(month) + 1]
        );

        const statsData = stats.rows[0];
        const summary = generateSummary(statsData, entries.rows);

        res.json({
            year: parseInt(year),
            month: parseInt(month),
            totalEntries: parseInt(statsData.total_entries),
            totalStudyHours: parseFloat(statsData.total_study_hours).toFixed(1),
            mostCommonMood: statsData.most_common_mood,
            gratitudeCount: parseInt(statsData.gratitude_count),
            studySubjects: statsData.study_subjects || [],
            summary: summary,
            entries: entries.rows
        });
    } catch (error) {
        console.error('❌ Error fetching monthly summary:', error);
        res.status(500).json({ error: 'Failed to fetch monthly summary' });
    }
});

function generateSummary(data, entries) {
    const { total_entries, total_study_hours, most_common_mood, gratitude_count } = data;

    if (total_entries === 0) {
        return "No entries for this month yet.";
    }

    let summary = `This month, you journaled ${total_entries} day${total_entries > 1 ? 's' : ''}. `;

    if (total_study_hours > 0) {
        summary += `You dedicated ${Math.round(total_study_hours * 10) / 10} hours to studying. `;
    }

    if (most_common_mood) {
        const moodEmojis = { productive: '🚀', normal: '😐', challenging: '💪', blocked: '🚧' };
        summary += `Your work vibe was mostly ${most_common_mood} ${moodEmojis[most_common_mood] || ''}. `;
    }

    if (gratitude_count > 0) {
        summary += `You expressed gratitude ${gratitude_count} time${gratitude_count > 1 ? 's' : ''}. `;
    }

    return summary;
}

// ==================== SERVER START ====================

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║   🚀 Life In Pixels - Work Tracker    ║
║                                        ║
║   Port: ${PORT}                          ║
║   Auth: Google OAuth 2.0               ║
║   Database: PostgreSQL                 ║
║   Security: Rate Limited ✓             ║
╚════════════════════════════════════════╝
  `);
    console.log(`✅ Server running at http://localhost:${PORT}`);
    console.log(`🔐 OAuth: http://localhost:${PORT}/api/auth/google`);
});

process.on('SIGTERM', () => {
    pool.end(() => console.log('💤 Database pool closed'));
    process.exit(0);
});


