-- User perks table for active perk slots
CREATE TABLE IF NOT EXISTS user_perks (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    perk_key VARCHAR(50) NOT NULL,
    slot_number INTEGER NOT NULL CHECK (slot_number >= 1 AND slot_number <= 6),
    activated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(user_id, slot_number),
    UNIQUE(user_id, perk_key)
);

-- Available perk slots per user (default 3, can buy more)
CREATE TABLE IF NOT EXISTS user_perk_slots (
    user_id BIGINT PRIMARY KEY REFERENCES users(uid) ON DELETE CASCADE,
    max_slots INTEGER NOT NULL DEFAULT 3 CHECK (max_slots >= 1 AND max_slots <= 6)
);

-- Index for querying active perks
CREATE INDEX IF NOT EXISTS idx_user_perks_user ON user_perks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_perks_active ON user_perks(user_id, expires_at) WHERE expires_at IS NULL OR expires_at > NOW();
