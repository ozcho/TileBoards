const express = require('express');
const db = require('../db');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { isAuthenticated } = require('../middleware/auth');
const router = express.Router();

// List boards publicly (name + id only)
router.get('/public', (req, res) => {
  const boards = db.prepare(
    'SELECT b.id, b.name, b.created_at, u.name as owner_name FROM boards b JOIN users u ON b.owner_id = u.id ORDER BY b.created_at DESC'
  ).all();
  res.json(boards);
});

// List boards for authenticated user
router.get('/', isAuthenticated, (req, res) => {
  let boards;
  if (req.user.is_admin) {
    boards = db.prepare(`
      SELECT b.*, u.name as owner_name
      FROM boards b
      JOIN users u ON b.owner_id = u.id
      ORDER BY b.created_at DESC
    `).all();
  } else {
    boards = db.prepare(`
      SELECT b.*, u.name as owner_name
      FROM boards b
      JOIN users u ON b.owner_id = u.id
      WHERE b.owner_id = ?
      ORDER BY b.created_at DESC
    `).all(req.user.id);
  }
  res.json(boards);
});

// Get board by ID (authenticated owner or admin)
router.get('/:id', isAuthenticated, (req, res) => {
  const board = db.prepare(`
    SELECT b.*, u.name as owner_name
    FROM boards b
    JOIN users u ON b.owner_id = u.id
    WHERE b.id = ?
  `).get(req.params.id);

  if (!board) return res.status(404).json({ error: 'Board no encontrado' });

  if (!req.user.is_admin && board.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const tiles = db.prepare(
    'SELECT * FROM tiles WHERE board_id = ? ORDER BY position'
  ).all(board.id);
  res.json({ ...board, tiles });
});

// Access board with password (anonymous or authenticated)
router.post('/:id/access', (req, res) => {
  const { password } = req.body;
  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(req.params.id);

  if (!board) return res.status(404).json({ error: 'Board no encontrado' });

  if (!bcrypt.compareSync(password, board.password_hash)) {
    return res.status(401).json({ error: 'Contraseña incorrecta' });
  }

  // Store board access in session
  if (!req.session.boardAccess) req.session.boardAccess = [];
  if (!req.session.boardAccess.includes(board.id)) {
    req.session.boardAccess.push(board.id);
  }

  const tiles = db.prepare(
    'SELECT * FROM tiles WHERE board_id = ? ORDER BY position'
  ).all(board.id);
  res.json({ id: board.id, name: board.name, owner_id: board.owner_id, tiles });
});

// Get board data for authorized session (anonymous access)
router.get('/:id/public', (req, res) => {
  const boardId = req.params.id;

  const hasSessionAccess = req.session.boardAccess?.includes(boardId);
  let isOwnerOrAdmin = false;
  if (req.isAuthenticated()) {
    const boardOwner = db.prepare('SELECT owner_id FROM boards WHERE id = ?').get(boardId);
    isOwnerOrAdmin = req.user.is_admin || boardOwner?.owner_id === req.user.id;
  }

  if (!hasSessionAccess && !isOwnerOrAdmin) {
    return res.status(401).json({ error: 'Acceso no autorizado', needsPassword: true });
  }

  const board = db.prepare('SELECT id, name, owner_id FROM boards WHERE id = ?').get(boardId);
  if (!board) return res.status(404).json({ error: 'Board no encontrado' });

  const tiles = db.prepare(
    'SELECT * FROM tiles WHERE board_id = ? ORDER BY position'
  ).all(boardId);
  res.json({ ...board, tiles });
});

// Create board
router.post('/', isAuthenticated, (req, res) => {
  const { name, password, tiles } = req.body;

  if (!name || !password) {
    return res.status(400).json({ error: 'Nombre y contraseña son requeridos' });
  }

  const id = uuidv4();
  const passwordHash = bcrypt.hashSync(password, 10);

  const insertBoard = db.prepare(
    'INSERT INTO boards (id, name, password_hash, owner_id) VALUES (?, ?, ?, ?)'
  );
  const insertTile = db.prepare(
    'INSERT INTO tiles (id, board_id, type, label, config, state, position) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  const transaction = db.transaction(() => {
    insertBoard.run(id, name, passwordHash, req.user.id);

    if (tiles && Array.isArray(tiles)) {
      tiles.forEach((tile, index) => {
        insertTile.run(
          uuidv4(), id, tile.type, tile.label || '',
          JSON.stringify(tile.config || {}),
          JSON.stringify(tile.state || getDefaultState(tile.type)),
          index
        );
      });
    }
  });

  transaction();

  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(id);
  const boardTiles = db.prepare(
    'SELECT * FROM tiles WHERE board_id = ? ORDER BY position'
  ).all(id);
  res.status(201).json({ ...board, tiles: boardTiles });
});

// Update board
router.put('/:id', isAuthenticated, (req, res) => {
  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(req.params.id);
  if (!board) return res.status(404).json({ error: 'Board no encontrado' });

  if (!req.user.is_admin && board.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const { name, password, tiles } = req.body;

  const transaction = db.transaction(() => {
    const updates = [];
    const params = [];

    if (name) { updates.push('name = ?'); params.push(name); }
    if (password) { updates.push('password_hash = ?'); params.push(bcrypt.hashSync(password, 10)); }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      params.push(req.params.id);
      db.prepare(`UPDATE boards SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    if (tiles && Array.isArray(tiles)) {
      db.prepare('DELETE FROM tiles WHERE board_id = ?').run(req.params.id);

      const insertTile = db.prepare(
        'INSERT INTO tiles (id, board_id, type, label, config, state, position) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );

      tiles.forEach((tile, index) => {
        insertTile.run(
          tile.id || uuidv4(), req.params.id, tile.type, tile.label || '',
          JSON.stringify(tile.config || {}),
          JSON.stringify(tile.state || getDefaultState(tile.type)),
          index
        );
      });
    }
  });

  transaction();

  const updated = db.prepare('SELECT * FROM boards WHERE id = ?').get(req.params.id);
  const updatedTiles = db.prepare(
    'SELECT * FROM tiles WHERE board_id = ? ORDER BY position'
  ).all(req.params.id);

  // Notify all connected clients viewing this board
  const io = req.app.get('io');
  io.to(req.params.id).emit('board-updated', {
    boardId: req.params.id,
    name: updated.name,
    tiles: updatedTiles.map(t => ({
      ...t,
      config: JSON.parse(t.config || '{}'),
      state: JSON.parse(t.state || '{}')
    }))
  });

  res.json({ ...updated, tiles: updatedTiles });
});

// Delete board
router.delete('/:id', isAuthenticated, (req, res) => {
  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(req.params.id);
  if (!board) return res.status(404).json({ error: 'Board no encontrado' });

  if (!req.user.is_admin && board.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const io = req.app.get('io');
  io.to(req.params.id).emit('board-deleted', { boardId: req.params.id });

  db.prepare('DELETE FROM boards WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

function getDefaultState(type) {
  switch (type) {
    case 'counter': return { value: 0 };
    default: return {};
  }
}

module.exports = router;
