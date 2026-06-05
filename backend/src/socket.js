const db = require('./db');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

function setupSocket(io, sessionMiddleware) {
  // In-memory lock state: boardId -> { locked: bool, tileId: string|null }
  const boardLockState = new Map();

  // Party board auto-delete: boardId -> timeoutHandle
  const partyDeleteTimers = new Map();
  const PARTY_TTL_MS = 30 * 60 * 1000; // 30 minutes

  function schedulePartyDelete(boardId) {
    if (partyDeleteTimers.has(boardId)) return; // already scheduled
    const handle = setTimeout(() => {
      partyDeleteTimers.delete(boardId);
      const sockets = io.sockets.adapter.rooms.get(boardId);
      if (!sockets || sockets.size === 0) {
        db.prepare('DELETE FROM boards WHERE id = ? AND party_mode = 1').run(boardId);
        console.log(`Party board ${boardId} auto-deleted after 30min idle`);
      }
    }, PARTY_TTL_MS);
    partyDeleteTimers.set(boardId, handle);
  }

  function cancelPartyDelete(boardId) {
    const handle = partyDeleteTimers.get(boardId);
    if (handle) {
      clearTimeout(handle);
      partyDeleteTimers.delete(boardId);
    }
  }

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

      // Cancel any pending auto-delete for party boards
      if (board.party_mode) cancelPartyDelete(boardId);

      // Send current board state
      const tiles = db.prepare(
        'SELECT * FROM tiles WHERE board_id = ? ORDER BY position'
      ).all(boardId);
      socket.emit('board-state', {
        boardId,
        name: board.name,
        tiles: tiles.map(parseTile),
        locked: boardLockState.get(boardId)?.locked || false
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

      // Unlock the board if it was locked by this tile
      const lockState = boardLockState.get(tile.board_id);
      if (lockState?.locked && lockState?.tileId === tileId) {
        boardLockState.set(tile.board_id, { locked: false, tileId: null });
        io.to(tile.board_id).emit('board-unlocked');
      }
    });

    // Stopwatch start
    socket.on('stopwatch-start', ({ tileId }) => {
      const tile = db.prepare(
        'SELECT * FROM tiles WHERE id = ? AND type = ?'
      ).get(tileId, 'stopwatch');
      if (!tile) return;

      const currentState = JSON.parse(tile.state || '{}');
      let state;

      if (currentState.paused) {
        // Resume: new startedAt from now, keep accumulated elapsed
        state = { startedAt: new Date().toISOString(), paused: false, pausedElapsed: currentState.pausedElapsed || 0 };
      } else {
        // Fresh start
        state = { startedAt: new Date().toISOString(), paused: false, pausedElapsed: 0 };
      }

      db.prepare('UPDATE tiles SET state = ? WHERE id = ?')
        .run(JSON.stringify(state), tileId);
      io.to(tile.board_id).emit('tile-updated', { tileId, state });
    });

    // Stopwatch pause
    socket.on('stopwatch-pause', ({ tileId }) => {
      const tile = db.prepare(
        'SELECT * FROM tiles WHERE id = ? AND type = ?'
      ).get(tileId, 'stopwatch');
      if (!tile) return;

      const currentState = JSON.parse(tile.state || '{}');
      if (!currentState.startedAt) return;

      const sinceStart = Math.floor((Date.now() - new Date(currentState.startedAt).getTime()) / 1000);
      const pausedElapsed = (currentState.pausedElapsed || 0) + sinceStart;

      const state = { startedAt: currentState.startedAt, paused: true, pausedElapsed };
      db.prepare('UPDATE tiles SET state = ? WHERE id = ?')
        .run(JSON.stringify(state), tileId);
      io.to(tile.board_id).emit('tile-updated', { tileId, state });
    });

    // Stopwatch reset
    socket.on('stopwatch-reset', ({ tileId }) => {
      const tile = db.prepare(
        'SELECT * FROM tiles WHERE id = ? AND type = ?'
      ).get(tileId, 'stopwatch');
      if (!tile) return;

      const state = { startedAt: null, paused: false, pausedElapsed: 0 };
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

      // Log the draw immediately
      const drawId = uuidv4();
      const now = new Date().toISOString();
      const name = authorName || 'Anónimo';
      db.prepare(
        'INSERT INTO chaosbag_draws (id, tile_id, tokens_drawn, author_name, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(drawId, tileId, JSON.stringify([token]), name, now);
      const entry = { id: drawId, tile_id: tileId, tokens_drawn: [token], author_name: name, created_at: now };
      io.to(tile.board_id).emit('chaosbag-draw-logged', { tileId, entry });
    });

    // Return drawn tokens (no log), then draw a fresh token and log it
    socket.on('chaosbag-draw-fresh', ({ tileId, authorName }) => {
      const tile = db.prepare(`SELECT * FROM tiles WHERE id = ? AND type IN ('chaosbag', 'arkham_bag')`).get(tileId);
      if (!tile) return;

      const state = JSON.parse(tile.state || '{}');
      let bag = state.bag || [];
      const drawn = state.drawn || [];
      const locked = state.locked || [];
      const name = authorName || 'Anónimo';

      // If there are drawn tokens, return them first (no log — was already logged at draw time)
      if (drawn.length > 0) {
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

      // Log the fresh draw immediately
      const drawId = uuidv4();
      const now = new Date().toISOString();
      db.prepare(
        'INSERT INTO chaosbag_draws (id, tile_id, tokens_drawn, author_name, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(drawId, tileId, JSON.stringify([token]), name, now);
      const entry = { id: drawId, tile_id: tileId, tokens_drawn: [token], author_name: name, created_at: now };
      io.to(tile.board_id).emit('chaosbag-draw-logged', { tileId, entry });
    });

    // Return all drawn tokens to the bag (draw was already logged at draw time)
    socket.on('chaosbag-return', ({ tileId, authorName }) => {
      const tile = db.prepare(`SELECT * FROM tiles WHERE id = ? AND type IN ('chaosbag', 'arkham_bag')`).get(tileId);
      if (!tile) return;

      const state = JSON.parse(tile.state || '{}');
      const drawn = state.drawn || [];
      if (drawn.length === 0) return;

      // Return tokens (bless/curse don't go back to bag)
      const regularTokens = drawn.filter(t => t !== 'bless' && t !== 'curse');
      const newState = { ...state, bag: [...(state.bag || []), ...regularTokens], drawn: [] };
      db.prepare('UPDATE tiles SET state = ? WHERE id = ?').run(JSON.stringify(newState), tileId);
      io.to(tile.board_id).emit('tile-updated', { tileId, state: newState });
    });

    // Return ALL drawn tokens to bag (including bless/curse) — used by the special "vaciar caja" button
    socket.on('chaosbag-return-all', ({ tileId }) => {
      const tile = db.prepare(`SELECT * FROM tiles WHERE id = ? AND type IN ('chaosbag', 'arkham_bag')`).get(tileId);
      if (!tile) return;

      const state = JSON.parse(tile.state || '{}');
      const drawn = state.drawn || [];
      if (drawn.length === 0) return;

      const newState = { ...state, bag: [...(state.bag || []), ...drawn], drawn: [] };
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

    // Persist icon token modifiers used by probability calculator and sync to all sessions
    socket.on('chaosbag-set-icon-value', ({ tileId, token, value }) => {
      const tile = db.prepare(`SELECT * FROM tiles WHERE id = ? AND type IN ('chaosbag', 'arkham_bag')`).get(tileId);
      if (!tile) return;

      const allowedTokens = new Set(['skull', 'cultist', 'tablet', 'elder_thing']);
      if (!allowedTokens.has(token)) return;

      const state = JSON.parse(tile.state || '{}');
      const iconValues = (state.iconValues && typeof state.iconValues === 'object')
        ? { ...state.iconValues }
        : {};

      if (value === '' || value === null || value === undefined) {
        if (iconValues[token] === undefined) return;
        delete iconValues[token];
      } else {
        const parsed = Number.parseInt(String(value), 10);
        if (!Number.isInteger(parsed)) return;
        const normalized = String(Math.max(0, parsed));
        if (iconValues[token] === normalized) return;
        iconValues[token] = normalized;
      }

      const newState = { ...state, iconValues };
      db.prepare('UPDATE tiles SET state = ? WHERE id = ?').run(JSON.stringify(newState), tileId);
      io.to(tile.board_id).emit('tile-updated', { tileId, state: newState });
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

    // ===== Dice =====

    socket.on('dice-roll', ({ tileId, dice, authorName }) => {
      const tile = db.prepare("SELECT * FROM tiles WHERE id = ? AND type = 'dice'").get(tileId);
      if (!tile) return;
      if (!Array.isArray(dice) || dice.length === 0) return;

      const sides = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100 };
      const name = authorName || 'Anónimo';
      const rolledAt = new Date().toISOString();

      const results = [];
      for (const entry of dice) {
        if (!entry || typeof entry !== 'object') continue;
        const numSides = sides[entry.type];
        const n = parseInt(entry.count, 10);
        if (!numSides || !Number.isInteger(n) || n < 1 || n > 9) continue;
        for (let i = 0; i < n; i++) {
          results.push({ type: entry.type, value: Math.floor(Math.random() * numSides) + 1 });
        }
        if (results.length >= 20) break; // safety cap
      }
      if (results.length === 0) return;

      const total = results.reduce((sum, r) => sum + r.value, 0);
      const newEntry = { dice: results, total, authorName: name, rolledAt };

      const currentState = JSON.parse(tile.state || '{}');
      const history = currentState.history || [];
      const newHistory = [newEntry, ...history].slice(0, 10);

      const newState = { lastRoll: newEntry, history: newHistory };
      db.prepare('UPDATE tiles SET state = ? WHERE id = ?').run(JSON.stringify(newState), tileId);
      io.to(tile.board_id).emit('tile-updated', { tileId, state: newState });
    });

    socket.on('special-dice-roll', ({ tileId, configId, dice, authorName }) => {
      const tile = db.prepare("SELECT * FROM tiles WHERE id = ? AND type = 'special_dice'").get(tileId);
      if (!tile) return;
      if (!Array.isArray(dice) || dice.length === 0) return;

      const config = JSON.parse(tile.config || '{}');
      const configurations = Array.isArray(config.configurations) ? config.configurations : [];
      const selected = configurations.find(c => c.id === configId)
        || configurations.find(c => c.id === config.selectedConfigId)
        || configurations[0];
      if (!selected) return;

      const diceMap = new Map(
        (Array.isArray(selected.dice) ? selected.dice : []).map((die) => [die.id, die])
      );

      const results = [];
      for (const entry of dice) {
        if (!entry || typeof entry !== 'object') continue;
        const die = diceMap.get(entry.id);
        if (!die) continue;

        const sides = Math.max(2, Math.min(100, parseInt(die.sides, 10) || 0));
        const faces = Array.isArray(die.faces) ? die.faces.slice(0, sides) : [];
        while (faces.length < sides) faces.push('');

        const n = parseInt(entry.count, 10);
        if (!Number.isInteger(n) || n < 1 || n > 9) continue;

        for (let i = 0; i < n; i++) {
          const faceIndex = Math.floor(Math.random() * sides);
          const value = String(faces[faceIndex] || '').slice(0, 24);
          const color = /^#[0-9a-fA-F]{6}$/.test(String(die.color || '').trim())
            ? String(die.color).trim()
            : '#3b82f6';
          results.push({
            dieId: die.id,
            title: String(die.title || 'Dado'),
            color,
            sides,
            value,
            faceIndex: faceIndex + 1
          });
        }

        if (results.length >= 30) break;
      }
      if (results.length === 0) return;

      const name = authorName || 'Anónimo';
      const rolledAt = new Date().toISOString();
      const newEntry = { dice: results, authorName: name, rolledAt };

      const currentState = JSON.parse(tile.state || '{}');
      const history = currentState.history || [];
      const newHistory = [newEntry, ...history].slice(0, 10);

      const newState = { lastRoll: newEntry, history: newHistory };
      db.prepare('UPDATE tiles SET state = ? WHERE id = ?').run(JSON.stringify(newState), tileId);
      io.to(tile.board_id).emit('tile-updated', { tileId, state: newState });
    });

    socket.on('random-cards-draw', ({ tileId, count, authorName }) => {
      const tile = db.prepare("SELECT * FROM tiles WHERE id = ? AND type = 'random_cards'").get(tileId);
      if (!tile) return;

      const config = JSON.parse(tile.config || '{}');
      const configurations = Array.isArray(config.configurations) ? config.configurations : [];
      const selected = configurations.find(c => c.id === config.selectedConfigId) || configurations[0];
      const rawCards = selected
        ? (Array.isArray(selected.cards) ? selected.cards : [])
        : (Array.isArray(config.cards) ? config.cards : []);
      const cards = rawCards
        .map((card) => {
          const id = String(card?.id || '').trim();
          const text = Array.from(String(card?.text || '').trim()).slice(0, 16).join('');
          if (!id || !text) return null;
          return { id, text };
        })
        .filter(Boolean);

      if (cards.length === 0) return;

      const validIds = new Set(cards.map(c => c.id));
      const state = JSON.parse(tile.state || '{}');

      const hasStateRemaining = Array.isArray(state.remaining);
      const initialRemaining = hasStateRemaining
        ? state.remaining.filter(id => validIds.has(id))
        : cards.map(c => c.id);

      if (initialRemaining.length === 0) return;

      const requested = Math.max(1, Math.min(9, parseInt(count, 10) || 1));
      const drawCount = Math.min(requested, initialRemaining.length);
      const pool = [...initialRemaining];
      const pickedIds = [];

      for (let i = 0; i < drawCount; i += 1) {
        const idx = Math.floor(Math.random() * pool.length);
        pickedIds.push(pool[idx]);
        pool.splice(idx, 1);
      }

      const name = authorName || 'Anónimo';
      const drawnAt = new Date().toISOString();
      const drawnCards = pickedIds.map((cardId) => {
        const match = cards.find(c => c.id === cardId);
        return { cardId, text: match?.text || '' };
      });

      const newEntry = { cards: drawnCards, authorName: name, drawnAt };
      const history = Array.isArray(state.history) ? state.history : [];
      const prevDrawn = Array.isArray(state.drawn) ? state.drawn.filter(id => validIds.has(id)) : [];
      const newState = {
        ...state,
        remaining: pool,
        drawn: [...prevDrawn, ...pickedIds],
        lastDraw: newEntry,
        history: [newEntry, ...history].slice(0, 12)
      };

      db.prepare('UPDATE tiles SET state = ? WHERE id = ?').run(JSON.stringify(newState), tileId);
      io.to(tile.board_id).emit('tile-updated', { tileId, state: newState });
    });

    socket.on('random-cards-draw-fresh', ({ tileId, count, authorName }) => {
      const tile = db.prepare("SELECT * FROM tiles WHERE id = ? AND type = 'random_cards'").get(tileId);
      if (!tile) return;

      const config = JSON.parse(tile.config || '{}');
      const configurations = Array.isArray(config.configurations) ? config.configurations : [];
      const selected = configurations.find(c => c.id === config.selectedConfigId) || configurations[0];
      const rawCards = selected
        ? (Array.isArray(selected.cards) ? selected.cards : [])
        : (Array.isArray(config.cards) ? config.cards : []);
      const cards = rawCards
        .map((card) => {
          const id = String(card?.id || '').trim();
          const text = Array.from(String(card?.text || '').trim()).slice(0, 16).join('');
          if (!id || !text) return null;
          return { id, text };
        })
        .filter(Boolean);

      if (cards.length === 0) return;

      const validIds = new Set(cards.map(c => c.id));
      const state = JSON.parse(tile.state || '{}');

      const hasStateRemaining = Array.isArray(state.remaining);
      const baseRemaining = hasStateRemaining
        ? state.remaining.filter(id => validIds.has(id))
        : cards.map(c => c.id);
      const currentDrawn = Array.isArray(state.drawn) ? state.drawn.filter(id => validIds.has(id)) : [];

      const fullPool = [...new Set([...baseRemaining, ...currentDrawn])];
      if (fullPool.length === 0) return;

      const requested = Math.max(1, Math.min(9, parseInt(count, 10) || 1));
      const drawCount = Math.min(requested, fullPool.length);
      const pool = [...fullPool];
      const pickedIds = [];

      for (let i = 0; i < drawCount; i += 1) {
        const idx = Math.floor(Math.random() * pool.length);
        pickedIds.push(pool[idx]);
        pool.splice(idx, 1);
      }

      const name = authorName || 'Anónimo';
      const drawnAt = new Date().toISOString();
      const drawnCards = pickedIds.map((cardId) => {
        const match = cards.find(c => c.id === cardId);
        return { cardId, text: match?.text || '' };
      });

      const newEntry = { cards: drawnCards, authorName: name, drawnAt };
      const history = Array.isArray(state.history) ? state.history : [];
      const newState = {
        ...state,
        remaining: pool,
        drawn: pickedIds,
        lastDraw: newEntry,
        history: [newEntry, ...history].slice(0, 12)
      };

      db.prepare('UPDATE tiles SET state = ? WHERE id = ?').run(JSON.stringify(newState), tileId);
      io.to(tile.board_id).emit('tile-updated', { tileId, state: newState });
    });

    socket.on('random-cards-reset', ({ tileId }) => {
      const tile = db.prepare("SELECT * FROM tiles WHERE id = ? AND type = 'random_cards'").get(tileId);
      if (!tile) return;

      const config = JSON.parse(tile.config || '{}');
      const state = JSON.parse(tile.state || '{}');
      const configurations = Array.isArray(config.configurations) ? config.configurations : [];
      const selected = configurations.find(c => c.id === config.selectedConfigId) || configurations[0];
      const rawCards = selected
        ? (Array.isArray(selected.cards) ? selected.cards : [])
        : (Array.isArray(config.cards) ? config.cards : []);
      const ids = rawCards
        .map(card => String(card?.id || '').trim())
        .filter(Boolean);

      const history = Array.isArray(state.history) ? state.history : [];
      const newState = { remaining: ids, drawn: [], lastDraw: null, history };
      db.prepare('UPDATE tiles SET state = ? WHERE id = ?').run(JSON.stringify(newState), tileId);
      io.to(tile.board_id).emit('tile-updated', { tileId, state: newState });
    });

    // Countdown finished - lock the board if lockOnZero is configured
    socket.on('countdown-finished', ({ tileId }) => {
      const tile = db.prepare(
        'SELECT * FROM tiles WHERE id = ? AND type = ?'
      ).get(tileId, 'countdown');
      if (!tile) return;

      const config = JSON.parse(tile.config || '{}');
      if (!config.lockOnZero) return;

      // Validate the countdown has actually reached 0
      const state = JSON.parse(tile.state || '{}');
      if (!state.startedAt || state.paused) return;

      const totalSeconds = (config.hours || 0) * 3600 + (config.minutes || 0) * 60 + (config.seconds || 0);
      const elapsed = Math.floor((Date.now() - new Date(state.startedAt).getTime()) / 1000);
      if (elapsed < totalSeconds) return;

      // Only lock once
      if (boardLockState.get(tile.board_id)?.locked) return;

      boardLockState.set(tile.board_id, { locked: true, tileId });
      io.to(tile.board_id).emit('board-locked', { tileId });
    });

    // Admin siren — broadcasts a play-sound event to all devices in the board
    socket.on('admin-siren', ({ boardId }) => {
      const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(boardId);
      if (!board) return;

      const session = socket.request.session;
      const userId = session?.passport?.user;
      if (!userId) return;

      const dbUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      if (!dbUser || (!dbUser.is_admin && board.owner_id !== dbUser.id)) return;

      io.to(boardId).emit('play-sound', { type: 'siren' });
    });

    // Board lock manual (owner/admin only)
    socket.on('board-lock', ({ boardId }) => {
      const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(boardId);
      if (!board) return;

      const session = socket.request.session;
      const userId = session?.passport?.user;
      if (!userId) return;

      const dbUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      if (!dbUser || (!dbUser.is_admin && board.owner_id !== dbUser.id)) return;

      if (boardLockState.get(boardId)?.locked) return;

      boardLockState.set(boardId, { locked: true, tileId: null });
      io.to(boardId).emit('board-locked', { tileId: null });
    });

    // Board unlock (owner/admin only)
    socket.on('board-unlock', ({ boardId }) => {
      const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(boardId);
      if (!board) return;

      const session = socket.request.session;
      const userId = session?.passport?.user;
      if (!userId) return;

      const dbUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      if (!dbUser || (!dbUser.is_admin && board.owner_id !== dbUser.id)) return;

      boardLockState.set(boardId, { locked: false, tileId: null });
      io.to(boardId).emit('board-unlocked');
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      const boardId = socket.boardId;
      if (boardId) {
        // After disconnect, check if party board is now empty
        setImmediate(() => {
          const board = db.prepare('SELECT party_mode FROM boards WHERE id = ?').get(boardId);
          if (board?.party_mode) {
            const room = io.sockets.adapter.rooms.get(boardId);
            if (!room || room.size === 0) {
              schedulePartyDelete(boardId);
            }
          }
        });
      }
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
