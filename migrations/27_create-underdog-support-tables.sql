-- Underdog support tracking
CREATE TABLE IF NOT EXISTS underdog_stats (
    user_id BIGINT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    chat_id BIGINT NOT NULL,
    consecutive_losses INTEGER NOT NULL DEFAULT 0,
    weekly_losses INTEGER NOT NULL DEFAULT 0,
    week_start DATE NOT NULL DEFAULT DATE_TRUNC('week', NOW()),
    comeback_boost_active BOOLEAN NOT NULL DEFAULT FALSE,
    phoenix_seed_given BOOLEAN NOT NULL DEFAULT FALSE,
    
    PRIMARY KEY(user_id, chat_id)
);

-- Mentorship relationships
CREATE TABLE IF NOT EXISTS mentorships (
    id SERIAL PRIMARY KEY,
    mentor_id BIGINT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    mentee_id BIGINT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    chat_id BIGINT NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    mentor_points_earned INTEGER NOT NULL DEFAULT 0,
    
    UNIQUE(mentee_id, chat_id)
);

-- Active buffs (like Blessed Sprout from full return mercy)
CREATE TABLE IF NOT EXISTS active_buffs (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    chat_id BIGINT,
    buff_key VARCHAR(50) NOT NULL,
    multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.0,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, chat_id, buff_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_underdog_stats_losses ON underdog_stats(consecutive_losses DESC);
CREATE INDEX IF NOT EXISTS idx_mentorships_active ON mentorships(mentee_id, chat_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_active_buffs_user ON active_buffs(user_id, expires_at) WHERE expires_at > NOW();

-- Function to reset weekly losses
CREATE OR REPLACE FUNCTION reset_weekly_underdog_stats()
RETURNS void AS $$
BEGIN
    UPDATE underdog_stats
    SET weekly_losses = 0,
        phoenix_seed_given = FALSE,
        week_start = DATE_TRUNC('week', NOW())
    WHERE week_start < DATE_TRUNC('week', NOW());
END;
$$ LANGUAGE plpgsql;
