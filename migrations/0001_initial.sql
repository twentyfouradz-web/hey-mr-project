CREATE TABLE IF NOT EXISTS categories (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
 parent_id INTEGER, icon TEXT DEFAULT '◆', sort_order INTEGER DEFAULT 0, active INTEGER DEFAULT 1, created_at TEXT
);
CREATE TABLE IF NOT EXISTS ads (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '', category TEXT DEFAULT '',
 district TEXT DEFAULT '', area TEXT DEFAULT '', price TEXT DEFAULT '', phone TEXT DEFAULT '',
 whatsapp TEXT DEFAULT '', image_url TEXT DEFAULT '', status TEXT DEFAULT 'pending', created_at TEXT
);
CREATE TABLE IF NOT EXISTS clients (
 id TEXT PRIMARY KEY, name TEXT DEFAULT '', mobile TEXT NOT NULL UNIQUE, verified INTEGER DEFAULT 0, created_at TEXT
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS form_fields (
 id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT NOT NULL, field_type TEXT DEFAULT 'text',
 required INTEGER DEFAULT 0, options_json TEXT DEFAULT '[]', sort_order INTEGER DEFAULT 0, active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS vip_promotions (
 id INTEGER PRIMARY KEY AUTOINCREMENT, ad_id TEXT, days INTEGER, amount REAL, status TEXT DEFAULT 'pending',
 reference TEXT DEFAULT '', created_at TEXT
);
INSERT OR IGNORE INTO settings(key,value) VALUES
 ('contact_buttons','{"call":true,"whatsapp":true,"chat":true}'),
 ('vip_pricing','{"3":300,"5":500,"7":700}'),
 ('registration_required','true');
