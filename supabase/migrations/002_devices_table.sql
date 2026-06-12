-- ══════════════════════════════════════════════════════════════════════
-- Migration: devices table
-- شغّل في Supabase → SQL Editor مرة واحدة
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS devices (
  codename      TEXT        PRIMARY KEY,
  display_name  TEXT        NOT NULL,
  brand         TEXT        NOT NULL DEFAULT '',
  chipset       TEXT        NOT NULL DEFAULT '',
  released      TEXT        NOT NULL DEFAULT '',
  image_url     TEXT,
  aliases       TEXT[]      NOT NULL DEFAULT '{}',
  variant_words TEXT[]      NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for brand filter
CREATE INDEX IF NOT EXISTS idx_devices_brand ON devices (brand);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS devices_updated_at ON devices;
CREATE TRIGGER devices_updated_at
  BEFORE UPDATE ON devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Seed initial data from device-db.ts ───────────────────────────────
-- Poco / Xiaomi
INSERT INTO devices (codename, display_name, brand, chipset, released, image_url, aliases, variant_words)
VALUES
  ('rodin',    'Poco X7 Pro',         'Xiaomi',   'Dimensity 8400-Ultra',   '2025', 'https://fdn2.gsmarena.com/vv/bigpic/xiaomi-poco-x7-pro.jpg',         ARRAY['pocox7pro','poco x7 pro','x7 pro poco'],              ARRAY['x7','pro']),
  ('ice',      'Poco X7',             'Xiaomi',   'Dimensity 7300 Ultra',   '2025', 'https://fdn2.gsmarena.com/vv/bigpic/xiaomi-poco-x7.jpg',             ARRAY['pocox7','poco x7'],                                   ARRAY['x7']),
  ('duchesse', 'Poco X6 Pro',         'Xiaomi',   'Dimensity 8300',         '2024', 'https://fdn2.gsmarena.com/vv/bigpic/xiaomi-poco-x6-pro.jpg',         ARRAY['pocox6pro','poco x6 pro'],                            ARRAY['x6','pro']),
  ('pissarro', 'Poco X6',             'Xiaomi',   'Dimensity 6080',         '2024', 'https://fdn2.gsmarena.com/vv/bigpic/xiaomi-poco-x6.jpg',             ARRAY['pocox6','poco x6'],                                   ARRAY['x6']),
  ('redwood',  'Poco X5 Pro',         'Xiaomi',   'Snapdragon 778G',        '2023', 'https://fdn2.gsmarena.com/vv/bigpic/xiaomi-poco-x5-pro.jpg',         ARRAY['pocox5pro','poco x5 pro'],                            ARRAY['x5','pro']),
  ('vermeer',  'Poco F6 Pro',         'Xiaomi',   'Snapdragon 8 Gen 2',     '2024', 'https://fdn2.gsmarena.com/vv/bigpic/xiaomi-poco-f6-pro.jpg',         ARRAY['pocof6pro','poco f6 pro'],                            ARRAY['f6','pro']),
  ('peridot',  'Poco F6',             'Xiaomi',   'Snapdragon 8s Gen 3',    '2024', 'https://fdn2.gsmarena.com/vv/bigpic/xiaomi-poco-f6.jpg',             ARRAY['pocof6','poco f6'],                                   ARRAY['f6']),
  ('marble',   'Poco F5',             'Xiaomi',   'Snapdragon 7+ Gen 2',    '2023', 'https://fdn2.gsmarena.com/vv/bigpic/xiaomi-poco-f5.jpg',             ARRAY['pocof5','poco f5'],                                   ARRAY['f5']),
  ('zircon',   'Redmi Note 14 Pro+',  'Xiaomi',   'Dimensity 9200+',        '2025', 'https://fdn2.gsmarena.com/vv/bigpic/xiaomi-redmi-note-14-pro-.jpg',  ARRAY['redmi note 14 pro plus','note 14 pro+'],              ARRAY['note','14','pro','plus']),
  ('swift',    'Redmi Note 14 Pro',   'Xiaomi',   'Dimensity 7300 Ultra',   '2025', 'https://fdn2.gsmarena.com/vv/bigpic/xiaomi-redmi-note-14-pro.jpg',   ARRAY['redmi note 14 pro','note 14 pro'],                    ARRAY['note','14','pro']),
  ('garnet',   'Redmi Note 13 Pro+',  'Xiaomi',   'Dimensity 1200 Ultra',   '2024', 'https://fdn2.gsmarena.com/vv/bigpic/xiaomi-redmi-note-13-pro-.jpg',  ARRAY['redmi note 13 pro plus','note 13 pro+'],              ARRAY['note','13','pro','plus']),
  ('emerald',  'Redmi Note 13 Pro',   'Xiaomi',   'Snapdragon 7s Gen 2',    '2024', 'https://fdn2.gsmarena.com/vv/bigpic/xiaomi-redmi-note-13-pro.jpg',   ARRAY['redmi note 13 pro','note 13 pro'],                    ARRAY['note','13','pro']),
  ('houji',    'Xiaomi 14',           'Xiaomi',   'Snapdragon 8 Gen 3',     '2024', 'https://fdn2.gsmarena.com/vv/bigpic/xiaomi-14.jpg',                  ARRAY['mi 14','xiaomi14'],                                   ARRAY['14']),
  ('shennong', 'Xiaomi 14 Pro',       'Xiaomi',   'Snapdragon 8 Gen 3',     '2024', 'https://fdn2.gsmarena.com/vv/bigpic/xiaomi-14-pro.jpg',              ARRAY['mi 14 pro','xiaomi14pro'],                            ARRAY['14','pro']),
  ('corot',    'Xiaomi 15',           'Xiaomi',   'Snapdragon 8 Elite',     '2025', 'https://fdn2.gsmarena.com/vv/bigpic/xiaomi-15.jpg',                  ARRAY['mi 15','xiaomi15'],                                   ARRAY['15']),
-- Samsung
  ('bov',      'Galaxy S25 Ultra',    'Samsung',  'Snapdragon 8 Elite',     '2025', 'https://fdn2.gsmarena.com/vv/bigpic/samsung-galaxy-s25-ultra.jpg',   ARRAY['samsung galaxy s25 ultra','s25 ultra'],               ARRAY['s25','ultra']),
  ('boc',      'Galaxy S25+',         'Samsung',  'Snapdragon 8 Elite',     '2025', 'https://fdn2.gsmarena.com/vv/bigpic/samsung-galaxy-s25-.jpg',        ARRAY['samsung galaxy s25 plus','s25+','s25 plus'],          ARRAY['s25','plus']),
  ('boe',      'Galaxy S25',          'Samsung',  'Snapdragon 8 Elite',     '2025', 'https://fdn2.gsmarena.com/vv/bigpic/samsung-galaxy-s25.jpg',         ARRAY['samsung galaxy s25','galaxy s25'],                    ARRAY['s25']),
  ('e3q',      'Galaxy S24 Ultra',    'Samsung',  'Snapdragon 8 Gen 3',     '2024', 'https://fdn2.gsmarena.com/vv/bigpic/samsung-galaxy-s24-ultra.jpg',   ARRAY['samsung galaxy s24 ultra','s24 ultra'],               ARRAY['s24','ultra']),
  ('b0s',      'Galaxy S24',          'Samsung',  'Exynos 2400',            '2024', 'https://fdn2.gsmarena.com/vv/bigpic/samsung-galaxy-s24.jpg',         ARRAY['samsung galaxy s24','galaxy s24'],                    ARRAY['s24']),
  ('a55x',     'Galaxy A55',          'Samsung',  'Exynos 1480',            '2024', 'https://fdn2.gsmarena.com/vv/bigpic/samsung-galaxy-a55.jpg',         ARRAY['samsung galaxy a55','galaxy a55'],                    ARRAY['a55']),
  ('a35x',     'Galaxy A35',          'Samsung',  'Exynos 1380',            '2024', 'https://fdn2.gsmarena.com/vv/bigpic/samsung-galaxy-a35.jpg',         ARRAY['samsung galaxy a35','galaxy a35'],                    ARRAY['a35']),
  ('q5q',      'Galaxy Z Fold 6',     'Samsung',  'Snapdragon 8 Gen 3',     '2024', 'https://fdn2.gsmarena.com/vv/bigpic/samsung-galaxy-z-fold6.jpg',     ARRAY['galaxy z fold6','z fold 6'],                          ARRAY['z','fold','6']),
  ('b5q',      'Galaxy Z Flip 6',     'Samsung',  'Snapdragon 8 Gen 3',     '2024', 'https://fdn2.gsmarena.com/vv/bigpic/samsung-galaxy-z-flip6.jpg',     ARRAY['galaxy z flip6','z flip 6'],                          ARRAY['z','flip','6']),
-- OnePlus
  ('odin3',    'OnePlus 13',          'OnePlus',  'Snapdragon 8 Elite',     '2025', 'https://fdn2.gsmarena.com/vv/bigpic/oneplus-13.jpg',                 ARRAY['op13','oneplus13','1+13'],                            ARRAY['13']),
  ('waffle',   'OnePlus 12',          'OnePlus',  'Snapdragon 8 Gen 3',     '2024', 'https://fdn2.gsmarena.com/vv/bigpic/oneplus-12.jpg',                 ARRAY['op12','oneplus12','1+12'],                            ARRAY['12']),
  ('salami',   'OnePlus 11',          'OnePlus',  'Snapdragon 8 Gen 2',     '2023', 'https://fdn2.gsmarena.com/vv/bigpic/oneplus-11.jpg',                 ARRAY['op11','oneplus11','1+11'],                            ARRAY['11']),
  ('ban',      'OnePlus Nord 4',      'OnePlus',  'Snapdragon 7+ Gen 3',    '2024', 'https://fdn2.gsmarena.com/vv/bigpic/oneplus-nord-4.jpg',             ARRAY['oneplus nord4','nord 4'],                             ARRAY['nord','4']),
-- Google
  ('komodo',   'Pixel 9 Pro XL',      'Google',   'Tensor G4',              '2024', 'https://fdn2.gsmarena.com/vv/bigpic/google-pixel-9-pro-xl.jpg',      ARRAY['google pixel 9 pro xl','pixel9 pro xl'],              ARRAY['9','pro','xl']),
  ('caiman',   'Pixel 9 Pro',         'Google',   'Tensor G4',              '2024', 'https://fdn2.gsmarena.com/vv/bigpic/google-pixel-9-pro.jpg',         ARRAY['google pixel 9 pro','pixel9pro'],                     ARRAY['9','pro']),
  ('tokay',    'Pixel 9',             'Google',   'Tensor G4',              '2024', 'https://fdn2.gsmarena.com/vv/bigpic/google-pixel-9.jpg',             ARRAY['google pixel 9','pixel9'],                            ARRAY['9']),
  ('husky',    'Pixel 8 Pro',         'Google',   'Tensor G3',              '2023', 'https://fdn2.gsmarena.com/vv/bigpic/google-pixel-8-pro.jpg',         ARRAY['google pixel 8 pro','pixel8pro'],                     ARRAY['8','pro']),
  ('shiba',    'Pixel 8',             'Google',   'Tensor G3',              '2023', 'https://fdn2.gsmarena.com/vv/bigpic/google-pixel-8.jpg',             ARRAY['google pixel 8','pixel8'],                            ARRAY['8']),
  ('akita',    'Pixel 8a',            'Google',   'Tensor G3',              '2024', 'https://fdn2.gsmarena.com/vv/bigpic/google-pixel-8a.jpg',            ARRAY['google pixel 8a','pixel8a'],                          ARRAY['8a']),
  ('cheetah',  'Pixel 7 Pro',         'Google',   'Tensor G2',              '2022', 'https://fdn2.gsmarena.com/vv/bigpic/google-pixel-7-pro.jpg',         ARRAY['google pixel 7 pro','pixel7pro'],                     ARRAY['7','pro']),
  ('panther',  'Pixel 7',             'Google',   'Tensor G2',              '2022', 'https://fdn2.gsmarena.com/vv/bigpic/google-pixel-7.jpg',             ARRAY['google pixel 7','pixel7'],                            ARRAY['7']),
  ('lynx',     'Pixel 7a',            'Google',   'Tensor G2',              '2023', 'https://fdn2.gsmarena.com/vv/bigpic/google-pixel-7a.jpg',            ARRAY['google pixel 7a','pixel7a'],                          ARRAY['7a']),
  ('raven',    'Pixel 6 Pro',         'Google',   'Tensor G1',              '2021', 'https://fdn2.gsmarena.com/vv/bigpic/google-pixel-6-pro.jpg',         ARRAY['google pixel 6 pro','pixel6pro'],                     ARRAY['6','pro']),
  ('oriole',   'Pixel 6',             'Google',   'Tensor G1',              '2021', 'https://fdn2.gsmarena.com/vv/bigpic/google-pixel-6.jpg',             ARRAY['google pixel 6','pixel6'],                            ARRAY['6']),
  ('bluejay',  'Pixel 6a',            'Google',   'Tensor G1',              '2022', 'https://fdn2.gsmarena.com/vv/bigpic/google-pixel-6a.jpg',            ARRAY['google pixel 6a','pixel6a'],                          ARRAY['6a']),
-- Nothing
  ('tetris',   'Nothing Phone (2a) Plus', 'Nothing', 'Dimensity 7350 Pro',  '2024', 'https://fdn2.gsmarena.com/vv/bigpic/nothing-phone-2a-plus.jpg',      ARRAY['nothing phone 2a plus','phone (2a) plus'],            ARRAY['2a','plus']),
  ('pong',     'Nothing Phone (2a)',  'Nothing',  'Dimensity 7200 Pro',     '2024', 'https://fdn2.gsmarena.com/vv/bigpic/nothing-phone-2a-.jpg',          ARRAY['nothing phone 2a','phone (2a)'],                      ARRAY['2a']),
  ('pong2',    'Nothing Phone (2)',   'Nothing',  'Snapdragon 8+ Gen 1',    '2023', 'https://fdn2.gsmarena.com/vv/bigpic/nothing-phone-2-.jpg',           ARRAY['nothing phone 2','phone (2)'],                        ARRAY['2']),
  ('asterix',  'Nothing Phone (1)',   'Nothing',  'Snapdragon 778G+',       '2022', 'https://fdn2.gsmarena.com/vv/bigpic/nothing-phone-1-.jpg',           ARRAY['nothing phone 1','phone (1)'],                        ARRAY['1']),
-- Realme
  ('rmx3890',  'Realme GT 7 Pro',     'Realme',   'Snapdragon 8 Elite',     '2024', 'https://fdn2.gsmarena.com/vv/bigpic/realme-gt-7-pro.jpg',            ARRAY['realme gt7 pro','gt 7 pro'],                          ARRAY['gt','7','pro']),
  ('rmx3741',  'Realme GT 6',         'Realme',   'Snapdragon 8s Gen 3',    '2024', 'https://fdn2.gsmarena.com/vv/bigpic/realme-gt-6.jpg',                ARRAY['realme gt6','gt 6'],                                  ARRAY['gt','6']),
-- Motorola
  ('cancunf',  'Motorola Edge 50 Pro','Motorola', 'Snapdragon 7 Gen 3',     '2024', 'https://fdn2.gsmarena.com/vv/bigpic/motorola-edge-50-pro.jpg',       ARRAY['moto edge 50 pro','edge 50 pro'],                     ARRAY['edge','50','pro']),
  ('cancunf_ultra','Motorola Edge 50 Ultra','Motorola','Snapdragon 8s Gen 3','2024','https://fdn2.gsmarena.com/vv/bigpic/motorola-edge-50-ultra.jpg',      ARRAY['moto edge 50 ultra'],                                 ARRAY['edge','50','ultra']),
-- ASUS
  ('ai2401',   'ASUS Zenfone 11 Ultra','ASUS',    'Snapdragon 8 Gen 3',     '2024', 'https://fdn2.gsmarena.com/vv/bigpic/asus-zenfone-11-ultra.jpg',      ARRAY['zenfone 11 ultra','zf11 ultra'],                      ARRAY['zenfone','11','ultra']),
  ('ai2202',   'ASUS ROG Phone 8 Pro','ASUS',     'Snapdragon 8 Gen 3',     '2024', 'https://fdn2.gsmarena.com/vv/bigpic/asus-rog-phone-8-pro.jpg',       ARRAY['rog phone 8 pro','rog 8 pro'],                        ARRAY['rog','8','pro'])
ON CONFLICT (codename) DO NOTHING;

-- ── View: orphan ROMs (لها device_codename بس مفيش entry في devices) ──
CREATE OR REPLACE VIEW orphan_rom_devices AS
SELECT DISTINCT
  r.device_codename,
  r.device        AS display_name,
  r.brand,
  COUNT(*)        AS rom_count
FROM roms r
LEFT JOIN devices d ON d.codename = r.device_codename
WHERE r.device_codename != ''
  AND r.device_codename IS NOT NULL
  AND d.codename IS NULL
GROUP BY r.device_codename, r.device, r.brand
ORDER BY rom_count DESC;
