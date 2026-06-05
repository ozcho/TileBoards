const express = require('express');
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const { isAuthenticated } = require('../middleware/auth');

const router = express.Router();

function sanitizeCards(cards) {
  return cards.map((card) => {
    const text = Array.from(String(card?.text || '').trim()).slice(0, 16).join('');
    return {
      id: card?.id || uuidv4(),
      text
    };
  }).filter(card => card.text !== '');
}

router.get('/', isAuthenticated, (req, res) => {
  const configs = db.prepare(
    'SELECT * FROM random_card_configs ORDER BY created_at DESC'
  ).all();
  res.json(configs.map(c => ({ ...c, cards: JSON.parse(c.cards || '[]') })));
});

router.post('/', isAuthenticated, (req, res) => {
  const { name, cards } = req.body;
  if (!name || !Array.isArray(cards) || cards.length === 0) {
    return res.status(400).json({ error: 'name y cards son requeridos' });
  }

  const sanitizedCards = sanitizeCards(cards);
  if (sanitizedCards.length === 0) {
    return res.status(400).json({ error: 'Debes incluir al menos una carta con texto.' });
  }

  const id = uuidv4();
  db.prepare(
    'INSERT INTO random_card_configs (id, name, cards, owner_id) VALUES (?, ?, ?, ?)'
  ).run(id, String(name).slice(0, 200), JSON.stringify(sanitizedCards), req.user.id);

  const saved = db.prepare('SELECT * FROM random_card_configs WHERE id = ?').get(id);
  res.status(201).json({ ...saved, cards: JSON.parse(saved.cards) });
});

router.put('/:id', isAuthenticated, (req, res) => {
  const config = db.prepare(
    'SELECT * FROM random_card_configs WHERE id = ?'
  ).get(req.params.id);

  if (!config) return res.status(404).json({ error: 'Configuración no encontrada' });
  if (!req.user.is_admin && config.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const { name, cards } = req.body;
  if (!name || !Array.isArray(cards) || cards.length === 0) {
    return res.status(400).json({ error: 'name y cards son requeridos' });
  }

  const sanitizedCards = sanitizeCards(cards);
  if (sanitizedCards.length === 0) {
    return res.status(400).json({ error: 'Debes incluir al menos una carta con texto.' });
  }

  db.prepare(
    'UPDATE random_card_configs SET name = ?, cards = ? WHERE id = ?'
  ).run(String(name).slice(0, 200), JSON.stringify(sanitizedCards), req.params.id);

  const updated = db.prepare('SELECT * FROM random_card_configs WHERE id = ?').get(req.params.id);
  res.json({ ...updated, cards: JSON.parse(updated.cards) });
});

router.delete('/:id', isAuthenticated, (req, res) => {
  const config = db.prepare(
    'SELECT * FROM random_card_configs WHERE id = ?'
  ).get(req.params.id);

  if (!config) return res.status(404).json({ error: 'Configuración no encontrada' });
  if (!req.user.is_admin && config.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  db.prepare('DELETE FROM random_card_configs WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
