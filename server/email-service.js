// Email Service for Life In Pixels
// Uses nodemailer to send emails via SMTP

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create reusable transporter
let transporter = null;

function initializeEmailService() {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT) || 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
        console.log('⚠️ Email service not configured (missing SMTP credentials)');
        return false;
    }

    transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for other ports
        auth: {
            user,
            pass
        }
    });

    // Verify connection
    transporter.verify()
        .then(() => console.log('✅ Email service connected'))
        .catch(err => {
            console.log('⚠️ Email service verification failed:', err.message);
            transporter = null;
        });

    return true;
}

/**
 * Send verification code email to employee
 */
export async function sendVerificationCodeEmail(email, code, employeeName) {
    if (!transporter) {
        console.log('⚠️ Email service not available, cannot send verification');
        return false;
    }

    const fromName = process.env.SMTP_FROM_NAME || 'Life In Pixels';
    const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

    const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: '🔐 Your Telegram Verification Code',
        html: `
            <div style="font-family: 'Courier New', monospace; max-width: 500px; margin: 0 auto; padding: 20px; background: #FAF9EE; border: 4px solid #2d2d2d;">
                <h1 style="font-size: 16px; color: #2d2d2d; margin-bottom: 20px;">📱 TELEGRAM VERIFICATION</h1>
                
                <p style="color: #555; font-size: 14px;">Hello <strong>${employeeName}</strong>,</p>
                
                <p style="color: #555; font-size: 14px;">Use this code to link your Telegram account:</p>
                
                <div style="background: #2d2d2d; padding: 20px; text-align: center; margin: 20px 0;">
                    <span style="font-size: 28px; letter-spacing: 8px; color: #FAF9EE; font-weight: bold;">${code}</span>
                </div>
                
                <p style="color: #888; font-size: 12px;">Reply to the bot with: <code>/code ${code}</code></p>
                
                <hr style="border: 1px solid #c4c0b8; margin: 20px 0;">
                
                <p style="color: #888; font-size: 11px;">
                    ⏰ This code expires in 15 minutes.<br>
                    If you didn't request this, please ignore this email.
                </p>
                
                <p style="color: #aaa; font-size: 10px; margin-top: 20px; text-align: center;">
                    Life In Pixels - Work Tracker
                </p>
            </div>
        `,
        text: `Your Telegram verification code is: ${code}\n\nReply to the bot with: /code ${code}\n\nThis code expires in 15 minutes.`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 Verification email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to send verification email:', error.message);
        return false;
    }
}

/**
 * Check if email service is available
 */
export function isEmailServiceAvailable() {
    return transporter !== null;
}

// Initialize on import
initializeEmailService();

export { initializeEmailService };
