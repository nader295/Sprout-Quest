-- Fix Supabase schema gaps imported over from the Firebase migration script.

-- 1. Standardize Country Codes (Fixes Map Nodes entirely)
UPDATE users 
SET country = UPPER(country) 
WHERE country IS NOT NULL AND country != UPPER(country);

-- 2. Propagate Subscribers Count correctly
UPDATE users
SET subscribers_count = followers_count
WHERE (subscribers_count IS NULL OR subscribers_count = 0) AND followers_count > 0;

-- 3. Verify total likes/downloads format mismatches
UPDATE users
SET 
  total_downloads = downloads_total
WHERE (total_downloads IS NULL OR total_downloads = 0) AND downloads_total > 0;
