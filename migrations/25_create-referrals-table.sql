-- Referral codes and tracking
CREATE TABLE IF NOT EXISTS referral_codes (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(uid) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Referral relationships
CREATE TABLE IF NOT EXISTS referrals (
    id SERIAL PRIMARY KEY,
    referrer_id BIGINT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    referee_id BIGINT NOT NULL UNIQUE REFERENCES users(uid) ON DELETE CASCADE,
    code_used VARCHAR(20) NOT NULL,
    referred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    reward_claimed_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT fk_referral_code FOREIGN KEY (code_used) REFERENCES referral_codes(code) ON DELETE CASCADE
);

-- Referral stats
CREATE TABLE IF NOT EXISTS referral_stats (
    user_id BIGINT PRIMARY KEY REFERENCES users(uid) ON DELETE CASCADE,
    successful_referrals INTEGER NOT NULL DEFAULT 0 CHECK (successful_referrals <= 50),
    total_bonus_cm INTEGER NOT NULL DEFAULT 0,
    total_bonus_sunbeams INTEGER NOT NULL DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_pending ON referrals(referrer_id, reward_claimed_at) WHERE reward_claimed_at IS NULL;

-- Constraint to enforce referral code format (SPROUT-NAME-XXXX pattern)
ALTER TABLE referral_codes
ADD CONSTRAINT chk_referral_code_format 
CHECK (code ~ '^SPROUT-[A-Z0-9]+-[A-Z0-9]{3,4}$');
