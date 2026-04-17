const db = require('./db');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

function setupSocket(io, sessionMiddleware) {
  // Share session with Socket.IO
  io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Join a board room
    socket.on('join-board', ({ boardId, password }) => {
      const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(boardId);
      if (!board) {
        return socket.emit('error', { message: 'Board no encontrado' });
      }

      const session = socket.request.session;
      const userId = session?.passport?.user;
      const hasSessionAccess = session?.boardAccess?.includes(boardId);

      let isOwnerOrAdmin = false;
      if (userId) {
        const dbUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        isOwnerOrAdmin = dbUser && (dbUser.is_admin || board.owner_id === dbUser.id);
      }

      if (!hasSessionAccess && !isOwnerOrAdmin) {
        if (!password) {
          return socket.emit('error', { message: 'Se requiere contraseña', needsPassword: true });
        }
        if (!bcrypt.compareSync(password, board.password_hash)) {
          return socket.emit('error', { message: 'Contraseña incorrecta' });
        }
        // Store access in session
        if (!session.boardAccess) session.boardAccess = [];
        if (!session.boardAccess.includes(boardId)) {
          session.boardAccess.push(boardId);
          session.save();
        }
      }

      socket.join(boardId);
      socket.boardId = boardId;

      // Send current board state
      const tiles = db.prepare(
        'SELECT * FROM tiles WHERE board_id = ? ORDER BY position'
      ).all(boardId);
      socket.emit('board-state', {
        boardId,
        name: board.name,
        tiles: tiles.map(parseTile)
      });
    });

    // Counter operations
    socket.on('counter-update', ({ tileId, delta, authorName }) => {
      const tile = db.prepare(
        'SELECT * FROM tiles WHERE id = ? AND type = ?'
      ).get(tileId, 'counter');
      if (!tile) return;

      const state = JSON.parse(tile.state || '{"value":0}');
      state.value = (state.value || 0) + delta;

      db.prepare('UPDATE tiles SET state = ? WHERE id = ?')
        .run(JSON.stringify(state), tileId);

      // Log history
      const config = JSON.parse(tile.config || '{}');
      if (config.historyVisibility && config.historyVisibility !== 'none') {
        const historyId = uuidv4();
        const now = new Date().toISOString();
        const name = authorName || 'Anónimo';
        db.prepare(
          'INSERT INTO counter_history (id, tile_id, delta, value_after, author_name, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(historyId, tileId, delta, state.value, name, now);

        const entry = { id: historyId, tile_id: tileId, delta, value_after: state.value, author_name: name, created_at: now };
        io.to(tile.board_id).emit('counter-history-added', { tileId, entry });
      }

      io.to(tile.board_id).emit('tile-updated', { tileId, state });
    });

    // Counter history - get
    socket.on('counter-history-get', ({ tileId }) => {
      const history = db.prepare(
        'SELECT * FROM counter_history WHERE tile_id = ? ORDER BY created_at DESC LIMIT 200'
      ).all(tileId);
      socket.emit('counter-history-list', { tileId, history });
    });

    // Countdown update (legacy)
    socket.on('countdown-update', ({ tileId, config }) => {
      const tile = db.prepare(
        'SELECT * FROM tiles WHERE id = ? AND type = ?'
      ).get(tileId, 'countdown');
      if (!tile) return;

      db.prepare('UPDATE tiles SET config = ? WHERE id = ?')
        .run(JSON.stringify(config), tileId);

      io.to(tile.board_id).emit('tile-updated', { tileId, config });
    });

    // Countdown start
    socket.on('countdown-start', ({ tileId }) => {
      const tile = db.prepare(
        'SELECT * FROM tiles WHERE id = ? AND type = ?'
      ).get(tileId, 'countdown');
      if (!tile) return;

      const currentState = JSON.parse(tile.state || '{}');
      let state;

      if (currentState.paused && currentState.pausedRemaining > 0) {
        // Resume: calculate new startedAt so remaining time matches
        const config = JSON.parse(tile.config || '{}');
        const totalSeconds = (config.hours || 0) * 3600 + (config.minutes || 0) * 60 + (config.seconds || 0);
        const elapsed = totalSeconds - currentState.pausedRemaining;
        const newStartedAt = new Date(Date.now() - elapsed * 1000).toISOString();
        state = { startedAt: newStartedAt, paused: false, pausedRemaining: 0 };
      } else {
        // Fresh start
        state = { startedAt: new Date().toISOString(), paused: false, pausedRemaining: 0 };
      }

      db.prepare('UPDATE tiles SET state = ? WHERE id = ?')
        .run(JSON.stringify(state), tileId);
      io.to(tile.board_id).emit('tile-updated', { tileId, state });
    });

    // Countdown pause
    socket.on('countdown-pause', ({ tileId }) => {
      const tile = db.prepare(
        'SELECT * FROM tiles WHERE id = ? AND type = ?'
      ).get(tileId, 'countdown');
      if (!tile) return;

      const currentState = JSON.parse(tile.state || '{}');
      if (!currentState.startedAt) return;

      const config = JSON.parse(tile.config || '{}');
      const totalSeconds = (config.hours || 0) * 3600 + (config.minutes || 0) * 60 + (config.seconds || 0);
      const elapsed = Math.floor((Date.now() - new Date(currentState.startedAt).getTime()) / 1000);
      const pausedRemaining = Math.max(0, totalSeconds - elapsed);

      const state = { startedAt: currentState.startedAt, paused: true, pausedRemaining };
      db.prepare('UPDATE tiles SET state = ? WHERE id = ?')
        .run(JSON.stringify(state), tileId);
      io.to(tile.board_id).emit('tile-updated', { tileId, state });
    });

    // Countdown reset
    socket.on('countdown-reset', ({ tileId }) => {
      const tile = db.prepare(
        'SELECT * FROM tiles WHERE id = ? AND type = ?'
      ).get(tileId, 'countdown');
      if (!tile) return;

      const state = { startedAt: null, paused: false, pausedRemaining: 0 };
      db.prepare('UPDATE tiles SET state = ? WHERE id = ?')
        .run(JSON.stringify(state), tileId);
      io.to(tile.board_id).emit('tile-updated', { tileId, state });
    });

    // Message board - add message
    socket.on('message-add', ({ tileId, text, authorName }) => {
      const tile = db.prepare(
        'SELECT * FROM tiles WHERE id = ? AND type = ?'
      ).get(tileId, 'messageboard');
      if (!tile) return;

      const id = uuidv4();
      const now = new Date().toISOString();
      db.prepare(
        'INSERT INTO messages (id, tile_id, text, author_name, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(id, tileId, text, authorName || 'Anónimo', now);

      const message = {
        id, tile_id: tileId, text,
        author_name: authorName || 'Anónimo',
        created_at: now
      };
      io.to(tile.board_id).emit('message-added', { tileId, message });
    });

    // Get messages for a tile
    socket.on('messages-get', ({ tileId }) => {
      const messages = db.prepare(
        'SELECT * FROM messages WHERE tile_id = ? ORDER BY created_at DESC LIMIT 100'
      ).all(tileId);
      socket.emit('messages-list', { tileId, messages });
    });

    // Message delete
    socket.on('message-delete', ({ messageId, tileId }) => {
      const tile = db.prepare('SELECT * FROM tiles WHERE id = ?').get(tileId);
      if (!tile) return;

      db.prepare('DELETE FROM messages WHERE id = ?').run(messageId);
      io.to(tile.board_id).emit('message-deleted', { tileId, messageId });
    });

    // ===== Chaos Bag =====

    // Draw a token from the bag
    socket.on('chaosbag-draw', ({ tileId, authorName }) => {
      const tile = db.prepare(`SELECT * FROM tiles WHERE id = ? AND type IN ('chaosbag', 'arkham_bag')`).get(tileId);
      if (!tile) return;

      const state = JSON.parse(tile.state || '{}');
      const bag = state.bag || [];
      const drawn = state.drawn || [];
      const locked = state.locked || [];

      if (bag.length === 0) return;

      const idx = Math.floor(Math.random() * bag.length);
      const token = bag[idx];
      const newBag = [...bag];
      newBag.splice(idx, 1);

      const newState = { ...state, bag: newBag, drawn: [...drawn, token], locked };
      db.prepare('UPDATE tiles SET state = ? WHERE id = ?').run(JSON.stringify(newState), tileId);
      io.to(tile.board_id).emit('tile-updated', { tileId, state: newState });
    });

    // Return drawn tokens, log the draw, then draw a fresh token
    socket.on('chaosbag-draw-fresh', ({ tileId, authorName }) => {
      const tile = db.prepare(`SELECT * FROM tiles WHERE id = ? AND type IN ('chaosbag', 'arkham_bag')`).get(tileId);
      if (!tile) return;

      const state = JSON.parse(tile.state || '{}');
      let bag = state.bag || [];
      const drawn = state.drawn || [];
      const locked = state.locked || [];
      const name = authorName || 'Anónimo';

      // If there are drawn tokens, return them first (log + bless/curse don't go back)
      if (drawn.length > 0) {
        const drawId = uuidv4();
        const now = new Date().toISOString();
        db.prepare(
          'INSERT INTO chaosbag_draws (id, tile_id, tokens_drawn, author_name, created_at) VALUES (?, ?, ?, ?, ?)'
        ).run(drawId, tileId, JSON.stringify(drawn), name, now);

        const entry = { id: drawId, tile_id: tileId, tokens_drawn: drawn, author_name: name, created_at: now };
        io.to(tile.board_id).emit('chaosbag-draw-logged', { tileId, entry });

        const regularTokens = drawn.filter(t => t !== 'bless' && t !== 'curse');
        bag = [...bag, ...regularTokens];
      }

      // Now draw a fresh token
      if (bag.length === 0) {
        // No tokens left after returning, just clear drawn
        const newState = { ...state, bag, drawn: [], locked };
        db.prepare('UPDATE tiles SET state = ? WHERE id = ?').run(JSON.stringify(newState), tileId);
        io.to(tile.board_id).emit('tile-updated', { tileId, state: newState });
        return;
      }

      const idx = Math.floor(Math.random() * bag.length);
      const token = bag[idx];
      bag.splice(idx, 1);

      const newState = { ...state, bag, drawn: [token], locked };
      db.prepare('UPDATE tiles SET state = ? WHERE id = ?').run(JSON.stringify(newState), tileId);
      io.to(tile.board_id).emit('tile-updated', { tileId, state: newState });
    });

    // Return all drawn tokens to the bag and log the draw
    socket.on('chaosbag-return', ({ tileId, authorName }) => {
      const tile = db.prepare(`SELECT * FROM tiles WHERE id = ? AND type IN ('chaosbag', 'arkham_bag')`).get(tileId);
      if (!tile) return;

      const state = JSON.parse(tile.state || '{}');
      const drawn = state.drawn || [];
      if (drawn.length === 0) return;

      // Log the draw
      const drawId = uuidv4();
      const now = new Date().toISOString();
      const name = authorName || 'Anónimo';
      db.prepare(
        'INSERT INTO chaosbag_draws (id, tile_id, tokens_drawn, author_name, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(drawId, tileId, JSON.stringify(drawn), name, now);

      const entry = { id: drawId, tile_id: tileId, tokens_drawn: drawn, author_name: name, created_at: now };
      io.to(tile.board_id).emit('chaosbag-draw-logged', { tileId, entry });

      // Return tokens (bless/curse don't go back to bag)
      const regularTokens = drawn.filter(t => t !== 'bless' && t !== 'curse');
      const newState = { ...state, bag: [...(state.bag || []), ...regularTokens], drawn: [] };
      db.prepare('UPDATE tiles SET state = ? WHERE id = ?').run(JSON.stringify(newState), tileId);
      io.to(tile.board_id).emit('tile-updated', { tileId, state: newState });
    });

    // Lock/seal a token (remove from bag temporarily)
    socket.on('chaosbag-lock', ({ tileId, tokenIndex }) => {
      const tile = db.prepare(`SELECT * FROM tiles WHERE id = ? AND type IN ('chaosbag', 'arkham_bag')`).get(tileId);
      if (!tile) return;

      const state = JSON.parse(tile.state || '{}');
      const bag = state.bag || [];
      if (tokenIndex < 0 || tokenIndex >= bag.length) return;

      const token = bag[tokenIndex];
      const newBag = [...bag];
      newBag.splice(tokenIndex, 1);
      const locked = [...(state.locked || []), token];

      const newState = { ...state, bag: newBag, locked };
      db.prepare('UPDATE tiles SET state = ? WHERE id = ?').run(JSON.stringify(newState), tileId);
      io.to(tile.board_id).emit('tile-updated', { tileId, state: newState });
    });

    // Unlock a token (return from locked to bag)
    socket.on('chaosbag-unlock', ({ tileId, tokenIndex }) => {
      const tile = db.prepare(`SELECT * FROM tiles WHERE id = ? AND type IN ('chaosbag', 'arkham_bag')`).get(tileId);
      if (!tile) return;

      const state = JSON.parse(tile.state || '{}');
      const locked = state.locked || [];
      if (tokenIndex < 0 || tokenIndex >= locked.length) return;

      const token = locked[tokenIndex];
      const newLocked = [...locked];
      newLocked.splice(tokenIndex, 1);

      const newState = { ...state, bag: [...(state.bag || []), token], locked: newLocked };
      db.prepare('UPDATE tiles SET state = ? WHERE id = ?').run(JSON.stringify(newState), tileId);
      io.to(tile.board_id).emit('tile-updated', { tileId, state: newState });
    });

    // Add a token permanently to the bag
    socket.on('chaosbag-add-token', ({ tileId, token }) => {
      const tile = db.prepare(`SELECT * FROM tiles WHERE id = ? AND type IN ('chaosbag', 'arkham_bag')`).get(tileId);
      if (!tile) return;

      const state = JSON.parse(tile.state || '{}');
      const bag = state.bag || [];
      const drawn = state.drawn || [];

      // Enforce max 10 bless/curse
      if (token === 'bless' || token === 'curse') {
        const count = bag.filter(t => t === token).length + drawn.filter(t => t === token).length;
        if (count >= 10) return;
      }

      const newState = { ...state, bag: [...bag, token] };
      db.prepare('UPDATE tiles SET state = ? WHERE id = ?').run(JSON.stringify(newState), tileId);
      io.to(tile.board_id).emit('tile-updated', { tileId, state: newState });
    });

    // Remove a token permanently from the bag
    socket.on('chaosbag-remove-token', ({ tileId, tokenIndex }) => {
      const tile = db.prepare(`SELECT * FROM tiles WHERE id = ? AND type IN ('chaosbag', 'arkham_bag')`).get(tileId);
      if (!tile) return;

      const state = JSON.parse(tile.state || '{}');
      const bag = state.bag || [];
      if (tokenIndex < 0 || tokenIndex >= bag.length) return;

      const newBag = [...bag];
      newBag.splice(tokenIndex, 1);
      const newState = { ...state, bag: newBag };
      db.prepare('UPDATE tiles SET state = ? WHERE id = ?').run(JSON.stringify(newState), tileId);
      io.to(tile.board_id).emit('tile-updated', { tileId, state: newState });
    });

    // Get draw history
    socket.on('chaosbag-draws-get', ({ tileId }) => {
      const draws = db.prepare(
        'SELECT * FROM chaosbag_draws WHERE tile_id = ? ORDER BY created_at DESC LIMIT 200'
      ).all(tileId);
      socket.emit('chaosbag-draws-list', {
        tileId,
        draws: draws.map(d => ({ ...d, tokens_drawn: JSON.parse(d.tokens_drawn) }))
      });
    });

    // Reset chaos bag to initial config (owner/admin only) or apply preset
    socket.on('chaosbag-reset', ({ tileId, tokenCounts: incomingTokenCounts, presetMeta }) => {
      const tile = db.prepare(`SELECT * FROM tiles WHERE id = ? AND type IN ('chaosbag', 'arkham_bag')`).get(tileId);
      if (!tile) return;

      // Check permissions
      const session = socket.request.session;
      const userId = session?.passport?.user;
      if (!userId) return;

      const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(tile.board_id);
      if (!board) return;

      const dbUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      if (!dbUser || (!dbUser.is_admin && board.owner_id !== dbUser.id)) return;

      const config = JSON.parse(tile.config || '{}');

      // If incoming tokenCounts provided (from preset), use those and update config
      let useTokenCounts = incomingTokenCounts || config.tokenCounts;

      let bag;
      if (useTokenCounts) {
        bag = [];
        Object.entries(useTokenCounts).forEach(([token, count]) => {
          for (let i = 0; i < count; i++) bag.push(token);
        });
      } else {
        // Fallback to presets
        const presets = {
          easy: ['+1', '+1', '0', '0', '0', '-1', '-1', '-1', '-2', '-3', 'skull', 'skull', 'cultist', 'tablet', 'elder_thing', 'tentacle', 'elder_star'],
          standard: ['+1', '0', '0', '-1', '-1', '-1', '-2', '-2', '-3', '-4', 'skull', 'skull', 'cultist', 'tablet', 'elder_thing', 'tentacle', 'elder_star'],
          hard: ['0', '-1', '-1', '-2', '-2', '-3', '-3', '-4', '-5', 'skull', 'skull', 'cultist', 'tablet', 'elder_thing', 'tentacle', 'elder_star'],
          expert: ['0', '-1', '-2', '-2', '-3', '-3', '-4', '-4', '-5', '-6', '-8', 'skull', 'skull', 'cultist', 'tablet', 'elder_thing', 'tentacle', 'elder_star'],
        };
        bag = presets[config.preset] || presets.standard;
      }

      const state = { bag, drawn: [], locked: [] };
      db.prepare('UPDATE tiles SET state = ? WHERE id = ?').run(JSON.stringify(state), tileId);

      // If preset meta provided, update the tile config
      if (incomingTokenCounts || presetMeta) {
        const newConfig = { ...config };
        if (incomingTokenCounts) newConfig.tokenCounts = incomingTokenCounts;
        if (presetMeta) {
          newConfig.campaign = presetMeta.campaign;
          newConfig.scenario = presetMeta.scenario;
          newConfig.difficulty = presetMeta.difficulty;
        }
        db.prepare('UPDATE tiles SET config = ? WHERE id = ?').run(JSON.stringify(newConfig), tileId);
        io.to(tile.board_id).emit('tile-config-updated', { tileId, config: newConfig });
      }

      io.to(tile.board_id).emit('tile-updated', { tileId, state });
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
}

function parseTile(tile) {
  return {
    ...tile,
    config: JSON.parse(tile.config || '{}'),
    state: JSON.parse(tile.state || '{}')
  };
}

module.exports = { setupSocket };
