const express = require('express');
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// List all party boards (public, no auth)
router.get('/boards', (req, res) => {
  const boards = db.prepare(
    'SELECT id, name, created_at FROM boards WHERE party_mode = 1 ORDER BY created_at DESC'
  ).all();
  res.json(boards);
});

// Create a party board (no auth, no password)
router.post('/boards', (req, res) => {
  const { name, tiles } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'El nombre del board es requerido' });
  }

  const id = uuidv4();
  const qrToken = uuidv4();
  // Dummy hash — party boards never use password auth
  const passwordHash = '$2b$10$invalidhashforpartymode000000000000000000000000000000';

  const insertBoard = db.prepare(
    'INSERT INTO boards (id, name, password_hash, owner_id, qr_token, party_mode) VALUES (?, ?, ?, ?, ?, 1)'
  );
  const insertTile = db.prepare(
    'INSERT INTO tiles (id, board_id, type, label, config, state, position) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  db.transaction(() => {
    insertBoard.run(id, name.trim(), passwordHash, 'party', qrToken);
    if (Array.isArray(tiles)) {
      tiles.forEach((tile, i) => {
        insertTile.run(
          uuidv4(), id, tile.type, tile.label || '',
          JSON.stringify(tile.config || {}),
          JSON.stringify(tile.state || {}),
          i
        );
      });
    }
  })();

  // Grant session access automatically
  if (!req.session.boardAccess) req.session.boardAccess = [];
  if (!req.session.boardAccess.includes(id)) req.session.boardAccess.push(id);

  const board = db.prepare('SELECT id, name, owner_id, party_mode FROM boards WHERE id = ?').get(id);
  const boardTiles = db.prepare('SELECT * FROM tiles WHERE board_id = ? ORDER BY position').all(id);
  res.status(201).json({ ...board, tiles: boardTiles });
});

// Access a party board (no password needed)
router.get('/boards/:id', (req, res) => {
  const board = db.prepare(
    'SELECT id, name, owner_id, party_mode FROM boards WHERE id = ? AND party_mode = 1'
  ).get(req.params.id);
  if (!board) return res.status(404).json({ error: 'Board no encontrado' });

  // Grant session access automatically
  if (!req.session.boardAccess) req.session.boardAccess = [];
  if (!req.session.boardAccess.includes(board.id)) req.session.boardAccess.push(board.id);

  const tiles = db.prepare('SELECT * FROM tiles WHERE board_id = ? ORDER BY position').all(board.id);
  res.json({ ...board, tiles });
});

module.exports = router;
