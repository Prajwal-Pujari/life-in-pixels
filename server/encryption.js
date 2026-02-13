// ==================== ENCRYPTION UTILITY ====================
// AES-256-GCM encryption for sensitive data (salary, etc.)

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Get encryption key from environment (must be 32 bytes / 64 hex chars)
function getEncryptionKey() {
    const key = process.env.SALARY_ENCRYPTION_KEY;
    if (!key) {
        throw new Error('SALARY_ENCRYPTION_KEY environment variable is required');
    }
    // Key should be 64 hex characters (32 bytes)
    if (key.length !== 64) {
        throw new Error('SALARY_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
    }
    return Buffer.from(key, 'hex');
}

/**
 * Encrypt a value using AES-256-GCM
 * @param {string|number} value - Value to encrypt
 * @returns {string} - Encrypted value in format: iv:authTag:encryptedData (all base64)
 */
export function encrypt(value) {
    try {
        const key = getEncryptionKey();
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        const text = String(value);
        let encrypted = cipher.update(text, 'utf8', 'base64');
        encrypted += cipher.final('base64');

        const authTag = cipher.getAuthTag();

        // Format: iv:authTag:encryptedData (all base64)
        return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
    } catch (error) {
        console.error('Encryption error:', error.message);
        throw new Error('Failed to encrypt data');
    }
}

/**
 * Decrypt a value encrypted with AES-256-GCM
 * @param {string} encryptedValue - Encrypted value in format: iv:authTag:encryptedData
 * @returns {string} - Decrypted value
 */
export function decrypt(encryptedValue) {
    try {
        if (!encryptedValue || !encryptedValue.includes(':')) {
            // Not encrypted, return as-is (for backward compatibility)
            return encryptedValue;
        }

        const key = getEncryptionKey();
        const parts = encryptedValue.split(':');

        if (parts.length !== 3) {
            // Not in expected format, return as-is
            return encryptedValue;
        }

        const [ivB64, authTagB64, encryptedData] = parts;
        const iv = Buffer.from(ivB64, 'base64');
        const authTag = Buffer.from(authTagB64, 'base64');

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error.message);
        // Return placeholder if decryption fails
        return '[ENCRYPTED]';
    }
}

/**
 * Encrypt a numeric amount
 * @param {number} amount - Amount to encrypt
 * @returns {string} - Encrypted amount
 */
export function encryptAmount(amount) {
    return encrypt(amount.toString());
}

/**
 * Decrypt an encrypted amount back to number
 * @param {string} encryptedAmount - Encrypted amount
 * @returns {number} - Decrypted amount
 */
export function decryptAmount(encryptedAmount) {
    const decrypted = decrypt(encryptedAmount);
    const num = parseFloat(decrypted);
    return isNaN(num) ? 0 : num;
}

/**
 * Check if encryption is properly configured
 * @returns {boolean} - Whether encryption is available
 */
export function isEncryptionConfigured() {
    try {
        getEncryptionKey();
        return true;
    } catch {
        return false;
    }
}

/**
 * Generate a new random encryption key (for setup)
 * @returns {string} - 64 character hex string
 */
export function generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
}

export default {
    encrypt,
    decrypt,
    encryptAmount,
    decryptAmount,
    isEncryptionConfigured,
    generateEncryptionKey
};
