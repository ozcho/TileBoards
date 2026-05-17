const express = require('express');
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const { isAuthenticated } = require('../middleware/auth');
const router = express.Router();

// List all configs — every authenticated user can see all configs
router.get('/', isAuthenticated, (req, res) => {
  const configs = db.prepare(
    'SELECT * FROM special_dice_configs ORDER BY created_at DESC'
  ).all();
  res.json(configs.map(c => ({ ...c, dice: JSON.parse(c.dice || '[]') })));
});

// Create a new config
router.post('/', isAuthenticated, (req, res) => {
  const { name, dice } = req.body;
  if (!name || !Array.isArray(dice) || dice.length === 0) {
    return res.status(400).json({ error: 'name y dice son requeridos' });
  }

  const sanitizedDice = dice.map(d => ({
    id: d.id || uuidv4(),
    title: String(d.title || 'Dado').slice(0, 100),
    color: /^#[0-9a-fA-F]{6}$/.test(String(d.color || '').trim()) ? d.color.trim() : '#3b82f6',
    sides: Math.max(2, Math.min(100, parseInt(d.sides, 10) || 6)),
    faces: (Array.isArray(d.faces) ? d.faces : [])
      .slice(0, 100)
      .map(f => Array.from(String(f || '')).slice(0, 6).join(''))
  }));

  const id = uuidv4();
  db.prepare(
    'INSERT INTO special_dice_configs (id, name, dice, owner_id) VALUES (?, ?, ?, ?)'
  ).run(id, String(name).slice(0, 200), JSON.stringify(sanitizedDice), req.user.id);

  const saved = db.prepare('SELECT * FROM special_dice_configs WHERE id = ?').get(id);
  res.status(201).json({ ...saved, dice: JSON.parse(saved.dice) });
});

// Update a config — owner or admin only
router.put('/:id', isAuthenticated, (req, res) => {
  const config = db.prepare(
    'SELECT * FROM special_dice_configs WHERE id = ?'
  ).get(req.params.id);

  if (!config) return res.status(404).json({ error: 'Configuración no encontrada' });
  if (!req.user.is_admin && config.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const { name, dice } = req.body;
  if (!name || !Array.isArray(dice) || dice.length === 0) {
    return res.status(400).json({ error: 'name y dice son requeridos' });
  }

  const sanitizedDice = dice.map(d => ({
    id: d.id || uuidv4(),
    title: String(d.title || 'Dado').slice(0, 100),
    color: /^#[0-9a-fA-F]{6}$/.test(String(d.color || '').trim()) ? d.color.trim() : '#3b82f6',
    sides: Math.max(2, Math.min(100, parseInt(d.sides, 10) || 6)),
    faces: (Array.isArray(d.faces) ? d.faces : [])
      .slice(0, 100)
      .map(f => Array.from(String(f || '')).slice(0, 6).join(''))
  }));

  db.prepare(
    "UPDATE special_dice_configs SET name = ?, dice = ? WHERE id = ?"
  ).run(String(name).slice(0, 200), JSON.stringify(sanitizedDice), req.params.id);

  const updated = db.prepare('SELECT * FROM special_dice_configs WHERE id = ?').get(req.params.id);
  res.json({ ...updated, dice: JSON.parse(updated.dice) });
});

// Delete a config — owner or admin only
router.delete('/:id', isAuthenticated, (req, res) => {
  const config = db.prepare(
    'SELECT * FROM special_dice_configs WHERE id = ?'
  ).get(req.params.id);

  if (!config) return res.status(404).json({ error: 'Configuración no encontrada' });
  if (!req.user.is_admin && config.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  db.prepare('DELETE FROM special_dice_configs WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
