-- Add mercy tracking to battle_stats table
ALTER TABLE battle_stats
ADD COLUMN IF NOT EXISTS mercy_shown INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS mercy_received INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS kind_soul_points INTEGER NOT NULL DEFAULT 0;

-- Create index for leaderboard queries on mercy stats
CREATE INDEX IF NOT EXISTS idx_battle_stats_kind_soul ON battle_stats(kind_soul_points DESC);
