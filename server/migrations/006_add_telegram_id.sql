-- Migration: Add telegram_id column to users table
-- This allows linking Telegram accounts to user accounts for bot authentication

-- Add telegram_id column (BIGINT because Telegram IDs are large numbers)
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id BIGINT UNIQUE;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);

-- Add comment
COMMENT ON COLUMN users.telegram_id IS 'Telegram user ID for bot authentication';
