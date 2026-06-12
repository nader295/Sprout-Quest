-- RomX Platform: Performance Optimization Indexes
-- Run this script in the Supabase SQL Editor to significantly speed up your queries.

-- ==============================================================================
-- 1. ROMs Table Indexes (High Traffic)
-- ==============================================================================
-- Speeds up filtering ROMs by device (e.g. /api/devices?codename=poco-x6-pro)
CREATE INDEX IF NOT EXISTS idx_roms_device_codename ON public.roms (device_codename);

-- Speeds up sorting ROMs by trend score (Dashboard / Trending)
CREATE INDEX IF NOT EXISTS idx_roms_trend_score ON public.roms (trend_score DESC);

-- Speeds up filtering for recently uploaded ROMs
CREATE INDEX IF NOT EXISTS idx_roms_created_at ON public.roms (created_at DESC);

-- Speeds up counting roms by maintainer (User Profile display)
CREATE INDEX IF NOT EXISTS idx_roms_maintainer_uid ON public.roms (maintainer_uid);


-- ==============================================================================
-- 2. Users Table Indexes 
-- ==============================================================================
-- Critical for the username availability check and login resolution
CREATE INDEX IF NOT EXISTS idx_users_username_lower ON public.users (username_lower);

-- Speeds up Leaderboard queries and ranking 
CREATE INDEX IF NOT EXISTS idx_users_xp ON public.users (xp DESC);

-- Speeds up filtering for verified devs/admins
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users (role);


-- ==============================================================================
-- 3. Social & Feed Indexes (Heavy Joins & Time Sorting)
-- ==============================================================================
-- Speeds up user activity timeline
CREATE INDEX IF NOT EXISTS idx_activity_uid_created ON public.activity (uid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_created_global ON public.activity (created_at DESC);

-- Speeds up Feed fan-out fetches for home page
CREATE INDEX IF NOT EXISTS idx_feed_items_owner_created ON public.feed_items (owner_uid, created_at DESC);

-- Speeds up follows table counts and checks
CREATE INDEX IF NOT EXISTS idx_follows_follower_following ON public.follows (follower_id, following_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON public.follows (following_id);


-- ==============================================================================
-- 4. Utility / Maintenance Indexes
-- ==============================================================================
-- Speeds up pending applications checks for Developers
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications (status);

-- Speeds up stale unread notification fetching
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read ON public.notifications (recipient_uid, read);

-- ==============================================================================
-- Analyze DB to update query planner statistics immediately
-- ==============================================================================
ANALYZE public.roms;
ANALYZE public.users;
ANALYZE public.activity;
ANALYZE public.feed_items;
ANALYZE public.follows;
