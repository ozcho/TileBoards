const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/presets/campaigns - list all campaigns
router.get('/campaigns', (req, res) => {
  const rows = db.prepare(
    'SELECT DISTINCT campaign FROM chaosbag_presets ORDER BY campaign'
  ).all();
  res.json(rows.map(r => r.campaign));
});

// GET /api/presets/scenarios?campaign=... - list scenarios for a campaign
router.get('/scenarios', (req, res) => {
  const { campaign } = req.query;
  if (!campaign) return res.status(400).json({ error: 'campaign required' });
  const rows = db.prepare(
    'SELECT DISTINCT scenario FROM chaosbag_presets WHERE campaign = ? ORDER BY id'
  ).all(campaign);
  res.json(rows.map(r => r.scenario));
});

// GET /api/presets/difficulties?campaign=...&scenario=... - list difficulties for a scenario
router.get('/difficulties', (req, res) => {
  const { campaign, scenario } = req.query;
  if (!campaign || !scenario) return res.status(400).json({ error: 'campaign and scenario required' });
  const rows = db.prepare(
    'SELECT DISTINCT difficulty FROM chaosbag_presets WHERE campaign = ? AND scenario = ? ORDER BY id'
  ).all(campaign, scenario);
  res.json(rows.map(r => r.difficulty));
});

// GET /api/presets/config?campaign=...&scenario=...&difficulty=... - get full preset config
router.get('/config', (req, res) => {
  const { campaign, scenario, difficulty } = req.query;
  if (!campaign || !scenario || !difficulty) return res.status(400).json({ error: 'campaign, scenario and difficulty required' });
  const row = db.prepare(
    'SELECT token_counts, campaign_log, victory_requirements, scenario_value FROM chaosbag_presets WHERE campaign = ? AND scenario = ? AND difficulty = ?'
  ).get(campaign, scenario, difficulty);
  if (!row) return res.status(404).json({ error: 'preset not found' });
  res.json({
    tokenCounts: JSON.parse(row.token_counts),
    campaignLog: row.campaign_log || null,
    victoryRequirements: row.victory_requirements || null,
    scenarioValue: row.scenario_value || null,
  });
});

module.exports = router;
