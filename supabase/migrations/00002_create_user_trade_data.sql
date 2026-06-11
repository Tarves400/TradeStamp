
-- Store all trade data per user as a single JSONB blob
CREATE TABLE IF NOT EXISTS user_trade_data (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_data jsonb NOT NULL DEFAULT '{}',
  profile_name text NOT NULL DEFAULT 'Trader',
  daily_target_value numeric NOT NULL DEFAULT 2,
  daily_target_last_date text,
  theme text NOT NULL DEFAULT 'dark',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_trade_data ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own data
CREATE POLICY "users can manage own data"
  ON user_trade_data FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
