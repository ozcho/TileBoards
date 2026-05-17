import { useState, useEffect, useRef } from 'react';
import TokenIcon from './TokenIcon';

const TOKEN_DISPLAY = {
  '+1': { label: '+1', icon: true, className: 'token-numeric' },
  '0': { label: '0', icon: true, className: 'token-numeric' },
  '-1': { label: '-1', icon: true, className: 'token-numeric' },
  '-2': { label: '-2', icon: true, className: 'token-numeric' },
  '-3': { label: '-3', icon: true, className: 'token-numeric' },
  '-4': { label: '-4', icon: true, className: 'token-numeric' },
  '-5': { label: '-5', icon: true, className: 'token-numeric' },
  '-6': { label: '-6', icon: true, className: 'token-numeric' },
  '-7': { label: '-7', icon: true, className: 'token-numeric' },
  '-8': { label: '-8', icon: true, className: 'token-numeric' },
  'skull': { label: 'Calavera', icon: true, className: 'token-skull' },
  'cultist': { label: 'Cultista', icon: true, className: 'token-cultist' },
  'tablet': { label: 'Tablilla', icon: true, className: 'token-tablet' },
  'elder_thing': { label: 'Ancestral', icon: true, className: 'token-elder-thing' },
  'tentacle': { label: 'Tentáculo', icon: true, className: 'token-autofail' },
  'elder_star': { label: 'Estrella', icon: true, className: 'token-eldersign' },
  'frost': { label: 'Escarcha', icon: true, className: 'token-frost' },
  'bless': { label: 'Bendito', icon: true, className: 'token-bless' },
  'curse': { label: 'Maldito', icon: true, className: 'token-curse' },
};

const ALL_TOKEN_TYPES = ['+1', '0', '-1', '-2', '-3', '-4', '-5', '-6', '-7', '-8',
  'skull', 'cultist', 'tablet', 'elder_thing', 'tentacle', 'elder_star', 'frost', 'bless', 'curse'];

const BLESS_CURSE_MAX = 10;

function tokenLabel(token, size) {
  const display = TOKEN_DISPLAY[token];
  if (!display) return token;
  if (display.icon) return <TokenIcon token={token} size={size} />;
  return display.label;
}

function tokenClass(token) {
  return TOKEN_DISPLAY[token]?.className || '';
}

export default function ChaosBagTile({ tile, socket, isOwnerOrAdmin, user, guestName, embedded, boardLocked }) {
  const state = tile.state || {};
  const bag = state.bag || [];
  const drawn = state.drawn || [];
  const locked = state.locked || [];

  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showProbability, setShowProbability] = useState(false);
  const [showBlessCurse, setShowBlessCurse] = useState(false);
  const [showBagContents, setShowBagContents] = useState(false);
  const [addToken, setAddToken] = useState('+1');
  const [probSkill, setProbSkill] = useState('');
  const [probDifficulty, setProbDifficulty] = useState('');
  const [iconValues, setIconValues] = useState(
    state.iconValues && typeof state.iconValues === 'object' ? state.iconValues : {}
  );
  const [newestDrawKey, setNewestDrawKey] = useState(0);
  const prevDrawnRef = useRef([]);
  const prevLockedLenRef = useRef(locked.length);

  const authorName = user?.name || guestName || 'Anónimo';

  // Auto-open Gestionar panel when a new token gets locked
  useEffect(() => {
    if (locked.length > prevLockedLenRef.current) {
      setShowManage(true);
    }
    prevLockedLenRef.current = locked.length;
  }, [locked.length]);

  useEffect(() => {
    const prevDrawn = prevDrawnRef.current;
    const prevLast = prevDrawn[prevDrawn.length - 1];
    const currLast = drawn[drawn.length - 1];
    if (drawn.length > 0 && (drawn.length !== prevDrawn.length || currLast !== prevLast)) {
      setNewestDrawKey(k => k + 1);
    }
    prevDrawnRef.current = drawn;
  }, [drawn]);

  useEffect(() => {
    const synced = state.iconValues && typeof state.iconValues === 'object' ? state.iconValues : {};
    setIconValues(synced);
  }, [tile.id, state.iconValues]);

  useEffect(() => {
    if (!socket) return;

    socket.emit('chaosbag-draws-get', { tileId: tile.id });

    const handleList = ({ tileId, draws }) => {
      if (tileId === tile.id) setHistory(draws);
    };
    const handleAdded = ({ tileId, entry }) => {
      if (tileId === tile.id) setHistory(prev => [entry, ...prev].slice(0, 200));
    };

    socket.on('chaosbag-draws-list', handleList);
    socket.on('chaosbag-draw-logged', handleAdded);

    return () => {
      socket.off('chaosbag-draws-list', handleList);
      socket.off('chaosbag-draw-logged', handleAdded);
    };
  }, [tile.id, socket]);

  const handleDrawFresh = () => {
    if (bag.length === 0) return;
    socket.emit('chaosbag-draw-fresh', { tileId: tile.id, authorName });
  };

  const handleDrawAnother = () => {
    if (bag.length === 0) return;
    socket.emit('chaosbag-draw', { tileId: tile.id, authorName });
  };

  const handleReturn = () => {
    if (drawn.length === 0) return;
    socket.emit('chaosbag-return', { tileId: tile.id, authorName });
  };

  const handleReturnAll = () => {
    if (drawn.length === 0) return;
    socket.emit('chaosbag-return-all', { tileId: tile.id });
  };

  const handleLock = (tokenIndex) => {
    socket.emit('chaosbag-lock', { tileId: tile.id, tokenIndex });
  };

  const handleUnlock = (tokenIndex) => {
    socket.emit('chaosbag-unlock', { tileId: tile.id, tokenIndex });
  };

  const handleAddToken = () => {
    socket.emit('chaosbag-add-token', { tileId: tile.id, token: addToken });
  };

  const handleRemoveToken = (tokenIndex) => {
    socket.emit('chaosbag-remove-token', { tileId: tile.id, tokenIndex });
  };

  const handleReset = () => {
    socket.emit('chaosbag-reset', { tileId: tile.id });
  };

  const handleIconValueChange = (token, rawValue) => {
    setIconValues(prev => {
      const next = { ...prev };
      if (rawValue === '') {
        delete next[token];
      } else {
        next[token] = rawValue;
      }
      return next;
    });
  };

  const handleIconValueBlur = (token, rawValue) => {
    if (!socket) return;

    const normalized = rawValue === ''
      ? ''
      : String(Math.max(0, Number.parseInt(rawValue, 10) || 0));

    setIconValues(prev => {
      const next = { ...prev };
      if (normalized === '') {
        delete next[token];
      } else {
        next[token] = normalized;
      }
      return next;
    });

    socket.emit('chaosbag-set-icon-value', {
      tileId: tile.id,
      token,
      value: normalized,
    });
  };

  const formatTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit' });
  };

  // Count tokens in bag for summary
  const bagSummary = {};
  bag.forEach(t => { bagSummary[t] = (bagSummary[t] || 0) + 1; });

  // Full bag summary: includes drawn (in display box) but NOT locked/sealed tokens
  const fullBagSummary = {};
  [...bag, ...drawn].forEach(t => { fullBagSummary[t] = (fullBagSummary[t] || 0) + 1; });
  const fullBagTotal = bag.length + drawn.length;

  // Progress bar
  const totalTokens = fullBagTotal;
  const pctRemaining = totalTokens > 0 ? Math.round((bag.length / totalTokens) * 100) : 100;

  // Bag composition: shows all tokens (including drawn/locked) with their composition percentage
  const probItems = Object.entries(fullBagSummary)
    .map(([token, count]) => ({ token, count, pct: fullBagTotal > 0 ? ((count / fullBagTotal) * 100).toFixed(1) : '0.0' }))
    .sort((a, b) => b.count - a.count);

  // Draw statistics from history
  const tokenStats = {};
  let totalStatDraws = 0;
  history.forEach(entry => {
    entry.tokens_drawn.forEach(t => {
      tokenStats[t] = (tokenStats[t] || 0) + 1;
      totalStatDraws++;
    });
  });
  const statItems = Object.entries(tokenStats)
    .map(([token, count]) => ({ token, count, pct: totalStatDraws > 0 ? ((count / totalStatDraws) * 100).toFixed(1) : '0.0' }))
    .sort((a, b) => b.count - a.count);

  // Probability calculator
  const TOKEN_NUMERIC_VALUES = {
    '+1': 1, '0': 0, '-1': -1, '-2': -2, '-3': -3, '-4': -4,
    '-5': -5, '-6': -6, '-7': -7, '-8': -8,
    'bless': 2, 'curse': -2, 'frost': -1,
  };
  const SPECIAL_CALC_TOKENS = ['skull', 'cultist', 'tablet', 'elder_thing'];
  const calcSkill = probSkill !== '' && !isNaN(+probSkill) ? +probSkill : null;
  const calcDiff  = probDifficulty !== '' && !isNaN(+probDifficulty) ? +probDifficulty : null;
  const calcReady = calcSkill !== null && calcDiff !== null;
  // Special tokens present in the full bag (to show icon value inputs)
  const specialInBag = SPECIAL_CALC_TOKENS.filter(t => fullBagSummary[t]);
  const latestDrawnToken = drawn[drawn.length - 1];
  const latestDrawnIconValue = SPECIAL_CALC_TOKENS.includes(latestDrawnToken)
    ? iconValues[latestDrawnToken]
    : null;
  const latestDrawnIconValueLabel = latestDrawnIconValue !== undefined
    && latestDrawnIconValue !== null
    && latestDrawnIconValue !== ''
    && !isNaN(+latestDrawnIconValue)
    ? `-${Math.abs(+latestDrawnIconValue)}`
    : null;
  let calcGroups = null;
  if (calcReady) {
    const threshold = calcDiff - calcSkill;
    const success = [], fail = [], special = [];
    bag.forEach(token => {
      if (token === 'elder_star') {
        success.push(token);
      } else if (token === 'tentacle') {
        fail.push(token);
      } else if (SPECIAL_CALC_TOKENS.includes(token)) {
        const iv = iconValues[token];
        const numVal = iv !== undefined && iv !== '' && !isNaN(+iv) ? -Math.abs(+iv) : null;
        if (numVal !== null) {
          (numVal >= threshold ? success : fail).push(token);
        } else {
          special.push(token);
        }
      } else if (TOKEN_NUMERIC_VALUES[token] !== undefined) {
        (TOKEN_NUMERIC_VALUES[token] >= threshold ? success : fail).push(token);
      } else {
        special.push(token);
      }
    });
    const tally = arr => { const c = {}; arr.forEach(t => { c[t] = (c[t] || 0) + 1; }); return Object.entries(c); };
    const pct = n => bag.length > 0 ? ((n / bag.length) * 100).toFixed(1) : '0.0';
    calcGroups = {
      threshold,
      success: { list: success, tally: tally(success), pct: pct(success.length) },
      fail:    { list: fail,    tally: tally(fail),    pct: pct(fail.length) },
      special: { list: special, tally: tally(special), pct: pct(special.length) },
      total: bag.length,
    };
  }

  // Bless/curse counts
  const blessInBag = bag.filter(t => t === 'bless').length + drawn.filter(t => t === 'bless').length;
  const curseInBag = bag.filter(t => t === 'curse').length + drawn.filter(t => t === 'curse').length;
  const blessAvailable = BLESS_CURSE_MAX - blessInBag;
  const curseAvailable = BLESS_CURSE_MAX - curseInBag;

  const handleAddBless = () => {
    if (blessAvailable <= 0) return;
    socket.emit('chaosbag-add-token', { tileId: tile.id, token: 'bless' });
  };

  const handleAddCurse = () => {
    if (curseAvailable <= 0) return;
    socket.emit('chaosbag-add-token', { tileId: tile.id, token: 'curse' });
  };

  const handleRemoveBless = () => {
    const idx = bag.indexOf('bless');
    if (idx === -1) return;
    socket.emit('chaosbag-remove-token', { tileId: tile.id, tokenIndex: idx });
  };

  const handleRemoveCurse = () => {
    const idx = bag.indexOf('curse');
    if (idx === -1) return;
    socket.emit('chaosbag-remove-token', { tileId: tile.id, tokenIndex: idx });
  };

  const content = (
    <>
      {/* === CAJA PROTAGONISTA: tamaño fijo === */}
      <div
        className="chaosbag-drawn-area"
        onClick={
          boardLocked ? undefined :
          drawn.length > 0 ? handleReturn :
          bag.length > 0 ? handleDrawFresh :
          undefined
        }
        style={{ cursor: (!boardLocked && (drawn.length > 0 || bag.length > 0)) ? 'pointer' : 'default' }}
        title={
          boardLocked ? undefined :
          drawn.length > 0 ? 'Devolver fichas a la bolsa' :
          bag.length > 0 ? 'Sacar ficha' :
          undefined
        }
      >
        {latestDrawnIconValueLabel && (
          <div className="chaosbag-drawn-icon-value" title="Valor configurado del icono">
            {latestDrawnIconValueLabel}
          </div>
        )}
        {drawn.length === 0 ? (
          <div className="chaosbag-empty-draw">
            {bag.length === 0 ? 'Bolsa vacía' : 'Pulsa para sacar ficha'}
          </div>
        ) : (
          <>
            <div className="chaosbag-drawn-tokens">
              {drawn.map((token, i) => {
                const isNewest = i === drawn.length - 1;
                return (
                  <span
                    key={isNewest ? `newest-${newestDrawKey}` : i}
                    className={`chaosbag-token ${isNewest ? 'chaosbag-token-large chaosbag-token-newest' : 'chaosbag-token-large chaosbag-token-previous'} ${tokenClass(token)}`}
                  >
                    {tokenLabel(token, isNewest ? 70 : 30)}
                  </span>
                );
              })}
            </div>
            {!boardLocked && drawn.some(t => t === 'bless' || t === 'curse') && (
              <button
                className="btn btn-xs btn-warning chaosbag-return-bc-btn"
                onClick={e => { e.stopPropagation(); handleReturnAll(); }}
                title="devolucion completa"
              >
                ↩ devolucion completa
              </button>
            )}
          </>
        )}
      </div>

      {/* === CONTROLES === */}
      <div className="chaosbag-controls">
        <button onClick={handleDrawFresh} className="btn btn-primary" disabled={bag.length === 0 || boardLocked}>
          🎲 Sacar ficha
        </button>
        {drawn.length > 0 && (
          <>
            <button onClick={handleDrawAnother} className="btn btn-secondary" disabled={bag.length === 0 || boardLocked} title="Sacar otra ficha sin devolver">
              ⟳ Sacar otra
            </button>
            <button onClick={handleReturn} className="btn btn-warning" disabled={boardLocked}>
              ↩ Limpiar ({drawn.length})
            </button>
          </>
        )}
      </div>

      {/* === META: conteo + barra compacta === */}
      <div className="chaosbag-meta">
        <span className="chaosbag-meta-count">🎒 {bag.length}{locked.length > 0 && <span className="chaosbag-meta-locked"> · 🔒{locked.length}</span>}</span>
        {totalTokens > 0 && (
          <div className="chaosbag-progress-track">
            <div className="chaosbag-progress-bar" style={{ width: `${pctRemaining}%` }} />
          </div>
        )}
        <span className="chaosbag-meta-pct">{pctRemaining}%</span>
      </div>

      {/* === BARRA SECUNDARIA: todo colapsado === */}
      <div className="chaosbag-secondary-bar">
        <button type="button" className={`btn btn-xs ${showBlessCurse ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setShowBlessCurse(v => !v)}>
          ✨ Bendi/Maldito
        </button>
        <button type="button" className={`btn btn-xs ${showBagContents ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setShowBagContents(v => !v)}>
          🎒 Bolsa
        </button>
        {history.length > 0 && (
          <button type="button" className={`btn btn-xs ${showStats ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setShowStats(v => !v)}>
            📊 Stats
          </button>
        )}
        <button type="button" className={`btn btn-xs ${showManage ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setShowManage(v => !v)}>
          ⚙ Gestionar
        </button>

        <button type="button" className={`btn btn-xs ${showHistory ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setShowHistory(v => !v)}>
          📜 ({history.length})
        </button>
      </div>

      {/* === PANELES EXPANDIBLES === */}

      {showBlessCurse && (
        <div className="chaosbag-bless-curse">
          <div className="chaosbag-bc-row">
            <span className="chaosbag-token chaosbag-token-sm token-bless"><TokenIcon token="bless" size={16} /></span>
            <span className="chaosbag-bc-label">Bendito</span>
            <span className="chaosbag-bc-count">{blessInBag}/{BLESS_CURSE_MAX}</span>
            <button onClick={handleAddBless} className="btn btn-xs btn-success" disabled={blessAvailable <= 0 || boardLocked}>+ Añadir</button>
            <button onClick={handleRemoveBless} className="btn btn-xs btn-danger" disabled={!bagSummary['bless'] || boardLocked}>− Quitar</button>
          </div>
          <div className="chaosbag-bc-row">
            <span className="chaosbag-token chaosbag-token-sm token-curse"><TokenIcon token="curse" size={16} /></span>
            <span className="chaosbag-bc-label">Maldito</span>
            <span className="chaosbag-bc-count">{curseInBag}/{BLESS_CURSE_MAX}</span>
            <button onClick={handleAddCurse} className="btn btn-xs btn-success" disabled={curseAvailable <= 0 || boardLocked}>+ Añadir</button>
            <button onClick={handleRemoveCurse} className="btn btn-xs btn-danger" disabled={!bagSummary['curse'] || boardLocked}>− Quitar</button>
          </div>
        </div>
      )}

      {showBagContents && (
        <div className="chaosbag-bag-contents">
          <div className="chaosbag-bag-header">
            <div className="chaosbag-bag-tokens">
              {ALL_TOKEN_TYPES.filter(t => fullBagSummary[t]).map(t => (
                <div key={t} className="chaosbag-summary-chip">
                  <span className={`chaosbag-token chaosbag-token-xs ${tokenClass(t)}`}>{tokenLabel(t, 22)}</span>
                  <span className="chaosbag-summary-count">×{fullBagSummary[t]}</span>
                </div>
              ))}
            </div>
            {fullBagTotal > 0 && (
              <button type="button" className="btn btn-xs btn-ghost" onClick={() => setShowProbability(!showProbability)}>
                {showProbability ? 'Ocultar %' : '% Prob'}
              </button>
            )}
          </div>
          {showProbability && fullBagTotal > 0 && (
            <div className="chaosbag-prob">
              <div className="chaosbag-prob-inputs">
                <div className="chaosbag-prob-input-group">
                  <label>Habilidad</label>
                  <input type="number" value={probSkill} onChange={e => setProbSkill(e.target.value)} className="input input-sm chaosbag-prob-input" placeholder="—" />
                </div>
                <span className="chaosbag-prob-vs">vs</span>
                <div className="chaosbag-prob-input-group">
                  <label>Dificultad</label>
                  <input type="number" value={probDifficulty} onChange={e => setProbDifficulty(e.target.value)} className="input input-sm chaosbag-prob-input" placeholder="—" />
                </div>
                {calcReady && (
                  <span className="chaosbag-prob-threshold">
                    mín. {calcGroups.threshold > 0 ? `+${calcGroups.threshold}` : calcGroups.threshold}
                  </span>
                )}
              </div>
              {specialInBag.length > 0 && (
                <div className="chaosbag-icon-values">
                  <span className="chaosbag-icon-values-label">Modificador según escenario:</span>
                  <div className="chaosbag-icon-values-row">
                    {specialInBag.map(token => (
                      <div key={token} className="chaosbag-icon-value-item">
                        <span className={`chaosbag-token chaosbag-token-xs ${tokenClass(token)}`}>{tokenLabel(token, 18)}</span>
                        <div className="chaosbag-icon-val-wrap">
                          <span className="chaosbag-icon-val-minus">−</span>
                          <input
                            type="number"
                            min="0"
                            value={iconValues[token] ?? ''}
                            onChange={e => handleIconValueChange(token, e.target.value)}
                            onBlur={e => handleIconValueBlur(token, e.target.value)}
                            className="input input-sm chaosbag-icon-val-input"
                            placeholder="?"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {calcReady ? (
                <div className="chaosbag-prob-groups">
                  <div className="chaosbag-prob-group chaosbag-prob-success">
                    <div className="chaosbag-prob-group-header">
                      <span>✅ Éxito</span>
                      <span className="chaosbag-prob-group-pct">{calcGroups.success.pct}%</span>
                      <span className="chaosbag-prob-group-count">({calcGroups.success.list.length}/{calcGroups.total})</span>
                    </div>
                    <div className="chaosbag-prob-group-tokens">
                      {calcGroups.success.tally.map(([token, count]) => (
                        <div key={token} className="chaosbag-summary-chip">
                          <span className={`chaosbag-token chaosbag-token-xs ${tokenClass(token)}`}>{tokenLabel(token, 20)}</span>
                          {count > 1 && <span className="chaosbag-summary-count">×{count}</span>}
                        </div>
                      ))}
                      {calcGroups.success.list.length === 0 && <span className="chaosbag-prob-empty">Ninguna</span>}
                    </div>
                  </div>
                  <div className="chaosbag-prob-group chaosbag-prob-fail">
                    <div className="chaosbag-prob-group-header">
                      <span>❌ Fracaso</span>
                      <span className="chaosbag-prob-group-pct">{calcGroups.fail.pct}%</span>
                      <span className="chaosbag-prob-group-count">({calcGroups.fail.list.length}/{calcGroups.total})</span>
                    </div>
                    <div className="chaosbag-prob-group-tokens">
                      {calcGroups.fail.tally.map(([token, count]) => (
                        <div key={token} className="chaosbag-summary-chip">
                          <span className={`chaosbag-token chaosbag-token-xs ${tokenClass(token)}`}>{tokenLabel(token, 20)}</span>
                          {count > 1 && <span className="chaosbag-summary-count">×{count}</span>}
                        </div>
                      ))}
                      {calcGroups.fail.list.length === 0 && <span className="chaosbag-prob-empty">Ninguna</span>}
                    </div>
                  </div>
                  {calcGroups.special.list.length > 0 && (
                    <div className="chaosbag-prob-group chaosbag-prob-special">
                      <div className="chaosbag-prob-group-header">
                        <span>⚠️ Especiales</span>
                        <span className="chaosbag-prob-group-pct">{calcGroups.special.pct}%</span>
                        <span className="chaosbag-prob-group-count">({calcGroups.special.list.length}/{calcGroups.total})</span>
                      </div>
                      <div className="chaosbag-prob-group-tokens">
                        {calcGroups.special.tally.map(([token, count]) => (
                          <div key={token} className="chaosbag-summary-chip">
                            <span className={`chaosbag-token chaosbag-token-xs ${tokenClass(token)}`}>{tokenLabel(token, 20)}</span>
                            {count > 1 && <span className="chaosbag-summary-count">×{count}</span>}
                          </div>
                        ))}
                      </div>
                      <p className="chaosbag-prob-special-note">Efecto depende del escenario e investigador</p>
                    </div>
                  )}
                </div>
              ) : (
                probItems.map(({ token, count, pct }) => (
                  <div key={token} className="chaosbag-prob-row">
                    <span className={`chaosbag-token chaosbag-token-xs ${tokenClass(token)}`}>{tokenLabel(token, 14)}</span>
                    <div className="chaosbag-prob-bar-wrap"><div className="chaosbag-prob-bar-inner" style={{ width: `${pct}%` }} /></div>
                    <span className="chaosbag-prob-pct">{pct}%</span>
                    <span className="chaosbag-prob-count">×{count}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {showManage && (
        <div className="chaosbag-manage-panel">
          <div className="chaosbag-manage-add">
            <label>Añadir ficha:</label>
            <select value={addToken} onChange={e => setAddToken(e.target.value)} className="input input-sm">
              {ALL_TOKEN_TYPES.map(t => (
                <option key={t} value={t}>{TOKEN_DISPLAY[t]?.label || t} ({t})</option>
              ))}
            </select>
            <button onClick={handleAddToken} className="btn btn-xs btn-success" disabled={boardLocked}>+ Añadir</button>
          </div>
          <div className="chaosbag-manage-remove">
            <label>Quitar ficha (pulsa para eliminar):</label>
            <div className="chaosbag-manage-tokens">
              {bag.map((token, i) => (
                <button key={i} className={`chaosbag-token chaosbag-token-manage chaosbag-token-removable ${tokenClass(token)}`} onClick={() => !boardLocked && handleRemoveToken(i)} disabled={boardLocked} title="Quitar permanentemente">
                  {tokenLabel(token, 28)}
                </button>
              ))}
            </div>
          </div>
          <div className="chaosbag-manage-lock">
            <label>Sellar ficha (pulsa para sellar):</label>
            <div className="chaosbag-manage-tokens">
              {bag.map((token, i) => (
                <button key={i} className={`chaosbag-token chaosbag-token-manage ${tokenClass(token)}`} onClick={() => !boardLocked && handleLock(i)} disabled={boardLocked} title="Sellar temporalmente">
                  {tokenLabel(token, 28)}
                </button>
              ))}
            </div>
          </div>
          {locked.length > 0 && (
            <div className="chaosbag-manage-locked">
              <label>Fichas selladas — pulsa para devolver a la bolsa:</label>
              <div className="chaosbag-manage-tokens">
                {locked.map((token, i) => (
                  <button key={i} className={`chaosbag-token chaosbag-token-manage chaosbag-token-locked ${tokenClass(token)}`} onClick={() => !boardLocked && handleUnlock(i)} disabled={boardLocked} title="Devolver a la bolsa">
                    {tokenLabel(token, 28)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {isOwnerOrAdmin && (
            <div className="chaosbag-manage-reset">
              <button onClick={handleReset} className="btn btn-sm btn-danger" disabled={boardLocked}>
                🔄 Resetear a configuración inicial
              </button>
            </div>
          )}
        </div>
      )}



      {showStats && history.length > 0 && (
        <div className="chaosbag-stats-panel">
          <div className="chaosbag-stats-summary">{totalStatDraws} fichas en {history.length} tiradas</div>
          {statItems.map(({ token, count, pct }) => (
            <div key={token} className="chaosbag-stats-row">
              <span className={`chaosbag-token chaosbag-token-xs ${tokenClass(token)}`}>{tokenLabel(token, 14)}</span>
              <div className="chaosbag-stats-bar-wrap"><div className="chaosbag-stats-bar-inner" style={{ width: `${pct}%` }} /></div>
              <span className="chaosbag-stats-pct">{pct}%</span>
              <span className="chaosbag-stats-count">×{count}</span>
            </div>
          ))}
        </div>
      )}

      {showHistory && (
        <div className="chaosbag-history-list">
          {history.length === 0 && <p className="text-muted">Sin tiradas registradas</p>}
          {history.map(entry => (
            <div key={entry.id} className="chaosbag-history-entry">
              <div className="chaosbag-history-tokens">
                {entry.tokens_drawn.map((t, i) => (
                  <span key={i} className={`chaosbag-token chaosbag-token-xs ${tokenClass(t)}`}>{tokenLabel(t, 12)}</span>
                ))}
              </div>
              <span className="chaosbag-history-author">{entry.author_name}</span>
              <span className="chaosbag-history-time">{formatTime(entry.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );

  if (embedded) return content;

  return (
    <div className="tile tile-chaosbag">
      <h3 className="tile-label">{tile.label || 'Bolsa del Caos'}</h3>
      {content}
    </div>
  );
}
