-- User currency (sunbeams)
CREATE TABLE IF NOT EXISTS user_currency (
    user_id BIGINT PRIMARY KEY REFERENCES users(uid) ON DELETE CASCADE,
    sunbeams INTEGER NOT NULL DEFAULT 0 CHECK (sunbeams >= 0),
    total_earned INTEGER NOT NULL DEFAULT 0,
    total_spent INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- User inventory for consumable items
CREATE TABLE IF NOT EXISTS user_inventory (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    item_key VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    
    UNIQUE(user_id, item_key)
);

-- Purchase history for auditing
CREATE TABLE IF NOT EXISTS purchase_history (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    item_key VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    price_paid INTEGER NOT NULL,
    purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    gift_to_user_id BIGINT REFERENCES users(uid) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_inventory_user ON user_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_history_user ON purchase_history(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_history_gift ON purchase_history(gift_to_user_id) WHERE gift_to_user_id IS NOT NULL;

-- Trigger to update currency updated_at
CREATE OR REPLACE FUNCTION update_user_currency_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_currency_updated_at
    BEFORE UPDATE ON user_currency
    FOR EACH ROW
    EXECUTE FUNCTION update_user_currency_updated_at();
