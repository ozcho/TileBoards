#!/usr/bin/env node
/**
 * migrate_preset_text.js
 *
 * Updates the campaign_log and victory_requirements columns in the existing
 * chaosbag_presets table to match the current presets-seed.json.
 *
 * Safe to run multiple times (idempotent). Only updates text fields;
 * does NOT touch users, boards, tiles or any game state.
 *
 * Usage:
 *   node scripts/migrate_preset_text.js
 *   (run from the project root, or from /backend)
 */

const path = require('path');
const fs = require('fs');

// Locate the DB relative to this script
const projectRoot = path.resolve(__dirname, '..');
const dbPath = path.join(projectRoot, 'backend', 'data', 'tileboards.db');
const seedPath = path.join(projectRoot, 'backend', 'src', 'presets-seed.json');

if (!fs.existsSync(dbPath)) {
  console.error(`DB not found at: ${dbPath}`);
  console.error('Make sure the backend has been started at least once to create the DB.');
  process.exit(1);
}

const Database = require(path.join(projectRoot, 'backend', 'node_modules', 'better-sqlite3'));
const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

const db = new Database(dbPath);

// Ensure columns exist (idempotent)
for (const col of [
  'ALTER TABLE chaosbag_presets ADD COLUMN campaign_log TEXT',
  'ALTER TABLE chaosbag_presets ADD COLUMN victory_requirements TEXT',
  'ALTER TABLE chaosbag_presets ADD COLUMN scenario_value INTEGER',
]) {
  try { db.exec(col); } catch (e) { /* already exists */ }
}

const update = db.prepare(`
  UPDATE chaosbag_presets
  SET campaign_log = ?, victory_requirements = ?, scenario_value = ?
  WHERE campaign = ? AND scenario = ? AND difficulty = ?
`);

const migrate = db.transaction((presets) => {
  let updated = 0;
  let skipped = 0;
  for (const p of presets) {
    const result = update.run(
      p.campaignLog ?? null,
      p.victoryRequirements ?? null,
      p.scenarioValue ?? null,
      p.campaign,
      p.scenario,
      p.difficulty
    );
    if (result.changes > 0) updated++;
    else skipped++;
  }
  return { updated, skipped };
});

const { updated, skipped } = migrate(seedData);
console.log(`Migration complete: ${updated} rows updated, ${skipped} rows not found (skipped).`);
db.close();
