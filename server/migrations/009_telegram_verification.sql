-- ============================================================
-- Migration 009: Telegram Verification & Enhanced Bot Features
-- Date: 2026-01-29
-- Description: 
--   - Add verification codes table for email-based Telegram linking
--   - Track entry/exit times separately for attendance
-- ============================================================

-- ============================================================
-- 1. TELEGRAM VERIFICATION CODES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS telegram_verification_codes (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL,
    telegram_username VARCHAR(255),
    telegram_first_name VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    verification_code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for quick lookups
CREATE INDEX IF NOT EXISTS idx_telegram_verification_telegram_id 
    ON telegram_verification_codes(telegram_id);
CREATE INDEX IF NOT EXISTS idx_telegram_verification_code 
    ON telegram_verification_codes(verification_code, expires_at);
CREATE INDEX IF NOT EXISTS idx_telegram_verification_email 
    ON telegram_verification_codes(email);

COMMENT ON TABLE telegram_verification_codes IS 'Temporary verification codes for Telegram account linking';
COMMENT ON COLUMN telegram_verification_codes.telegram_id IS 'Telegram user ID requesting verification';
COMMENT ON COLUMN telegram_verification_codes.verification_code IS '6-digit verification code';
COMMENT ON COLUMN telegram_verification_codes.expires_at IS 'Code expiry time (typically 15 minutes)';
COMMENT ON COLUMN telegram_verification_codes.attempts IS 'Number of failed verification attempts';

-- ============================================================
-- 2. ADD TELEGRAM CHAT ID FOR DIRECT MESSAGES
-- ============================================================

-- Add telegram_chat_id column for sending direct messages
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_users_telegram_chat_id ON users(telegram_chat_id);

COMMENT ON COLUMN users.telegram_chat_id IS 'Telegram private chat ID for sending direct notifications';

-- ============================================================
-- 3. CLEANUP FUNCTION FOR EXPIRED CODES
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM telegram_verification_codes
    WHERE expires_at < CURRENT_TIMESTAMP OR verified = TRUE;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_verification_codes IS 'Removes expired or used verification codes';

-- ============================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================

/*
To rollback this migration:

DROP FUNCTION IF EXISTS cleanup_expired_verification_codes();
DROP INDEX IF EXISTS idx_users_telegram_chat_id;
ALTER TABLE users DROP COLUMN IF EXISTS telegram_chat_id;
DROP INDEX IF EXISTS idx_telegram_verification_email;
DROP INDEX IF EXISTS idx_telegram_verification_code;
DROP INDEX IF EXISTS idx_telegram_verification_telegram_id;
DROP TABLE IF EXISTS telegram_verification_codes;
*/

-- ============================================================
-- END OF MIGRATION
-- ============================================================
