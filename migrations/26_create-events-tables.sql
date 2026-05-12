-- Global monthly events
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    event_key VARCHAR(50) NOT NULL UNIQUE,
    name_key VARCHAR(100) NOT NULL,
    description_key VARCHAR(200),
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
    event_type VARCHAR(30) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- User participation in events
CREATE TABLE IF NOT EXISTS event_participation (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    chat_id BIGINT,
    score INTEGER NOT NULL DEFAULT 0,
    actions_count INTEGER NOT NULL DEFAULT 0,
    first_action_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_action_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    reward_claimed BOOLEAN NOT NULL DEFAULT FALSE,
    
    UNIQUE(event_id, user_id, chat_id)
);

-- Event leaderboards (cached for performance)
CREATE TABLE IF NOT EXISTS event_leaderboard (
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    total_score INTEGER NOT NULL DEFAULT 0,
    rank INTEGER,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY(event_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_events_active ON events(starts_at, ends_at) WHERE ends_at > NOW();
CREATE INDEX IF NOT EXISTS idx_event_participation_event ON event_participation(event_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_event_participation_user ON event_participation(user_id);
CREATE INDEX IF NOT EXISTS idx_event_leaderboard_rank ON event_leaderboard(event_id, rank) WHERE rank IS NOT NULL;
