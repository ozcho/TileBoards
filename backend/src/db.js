const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'countineitor.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar TEXT,
    provider TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    approved INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS boards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tiles (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('countdown', 'clock', 'counter', 'messageboard', 'chaosbag', 'arkham_bag')),
    label TEXT DEFAULT '',
    config TEXT DEFAULT '{}',
    state TEXT DEFAULT '{}',
    position INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    tile_id TEXT NOT NULL,
    text TEXT NOT NULL,
    author_name TEXT DEFAULT 'Anónimo',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tile_id) REFERENCES tiles(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS counter_history (
    id TEXT PRIMARY KEY,
    tile_id TEXT NOT NULL,
    delta INTEGER NOT NULL,
    value_after INTEGER NOT NULL,
    author_name TEXT DEFAULT 'Anónimo',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tile_id) REFERENCES tiles(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chaosbag_draws (
    id TEXT PRIMARY KEY,
    tile_id TEXT NOT NULL,
    tokens_drawn TEXT NOT NULL,
    author_name TEXT DEFAULT 'Anónimo',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tile_id) REFERENCES tiles(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chaosbag_presets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign TEXT NOT NULL,
    scenario TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    token_counts TEXT NOT NULL,
    UNIQUE(campaign, scenario, difficulty)
  );
`);

// Migration: add approved column if missing
try {
  db.exec(`ALTER TABLE users ADD COLUMN approved INTEGER DEFAULT 0`);
  // Auto-approve existing admins
  db.exec(`UPDATE users SET approved = 1 WHERE is_admin = 1`);
} catch (e) {
  // Column already exists
}

// Migration: update tiles CHECK constraint to include chaosbag and arkham_bag
try {
  const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='tiles'").get();
  if (tableInfo && !tableInfo.sql.includes('arkham_bag')) {
    db.exec(`
      CREATE TABLE tiles_new (
        id TEXT PRIMARY KEY,
        board_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('countdown', 'clock', 'counter', 'messageboard', 'chaosbag', 'arkham_bag')),
        label TEXT DEFAULT '',
        config TEXT DEFAULT '{}',
        state TEXT DEFAULT '{}',
        position INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
      );
      INSERT INTO tiles_new SELECT * FROM tiles;
      DROP TABLE tiles;
      ALTER TABLE tiles_new RENAME TO tiles;
    `);
  }
} catch (e) {
  // Already migrated
}

// Seed chaosbag_presets from JSON file
try {
  const seedData = JSON.parse(fs.readFileSync(path.join(__dirname, 'presets-seed.json'), 'utf8'));
  const count = db.prepare('SELECT COUNT(*) as c FROM chaosbag_presets').get().c;
  if (count !== seedData.length) {
    db.exec('DELETE FROM chaosbag_presets');
    const insert = db.prepare(
      'INSERT OR IGNORE INTO chaosbag_presets (campaign, scenario, difficulty, token_counts) VALUES (?, ?, ?, ?)'
    );
    const seed = db.transaction((presets) => {
      for (const p of presets) {
        insert.run(p.campaign, p.scenario, p.difficulty, JSON.stringify(p.tokenCounts));
      }
    });
    seed(seedData);
    console.log(`Seeded ${seedData.length} chaos bag presets`);
  }
} catch (e) {
  console.error('Error seeding chaosbag_presets:', e.message);
}

module.exports = db;
