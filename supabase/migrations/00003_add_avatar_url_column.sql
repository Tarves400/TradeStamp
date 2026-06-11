-- Add avatar_url column to user_trade_data
ALTER TABLE user_trade_data ADD COLUMN IF NOT EXISTS avatar_url text;
