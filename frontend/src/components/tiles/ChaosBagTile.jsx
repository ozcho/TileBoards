import { useState, useEffect } from 'react';
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
  'skull', 'cultist', 'tablet', 'elder_thing', 'tentacle', 'elder_star', 'frost'];

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
  const [showLocked, setShowLocked] = useState(false);
  const [addToken, setAddToken] = useState('+1');

  const authorName = user?.name || guestName || 'Anónimo';

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

  const formatTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit' });
  };

  // Count tokens in bag for summary
  const bagSummary = {};
  bag.forEach(t => { bagSummary[t] = (bagSummary[t] || 0) + 1; });

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
      {/* Drawn tokens display */}
      <div className="chaosbag-drawn-area" onClick={bag.length > 0 && !boardLocked ? handleDrawFresh : undefined} style={{ cursor: bag.length > 0 && !boardLocked ? 'pointer' : 'default' }}>
        {drawn.length === 0 ? (
          <div className="chaosbag-empty-draw">Saca una ficha de la bolsa</div>
        ) : (
          <div className="chaosbag-drawn-tokens">
            {drawn.map((token, i) => (
              <span key={i} className={`chaosbag-token chaosbag-token-large ${tokenClass(token)}`}>
                {tokenLabel(token, 28)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Draw controls */}
      <div className="chaosbag-controls">
        <button onClick={handleDrawFresh} className="btn btn-primary" disabled={bag.length === 0 || boardLocked}>
          🎲 Sacar ficha
        </button>
        {drawn.length > 0 && (
          <>
            <button onClick={handleDrawAnother} className="btn btn-secondary" disabled={bag.length === 0 || boardLocked} title="Sacar otra ficha sin devolver">
              + Otra
            </button>
            <button onClick={handleReturn} className="btn btn-warning" disabled={boardLocked}>
              ↩ Devolver ({drawn.length})
            </button>
          </>
        )}
      </div>

      {/* Bag summary */}
      <div className="chaosbag-summary">
        <span className="chaosbag-count">🎒 {bag.length} fichas en la bolsa</span>
        {locked.length > 0 && (
          <span className="chaosbag-locked-count">🔒 {locked.length} selladas</span>
        )}
      </div>

      {/* Bless / Curse controls */}
      <div className="chaosbag-bless-curse">
        <div className="chaosbag-bc-row">
          <span className={`chaosbag-token chaosbag-token-sm token-bless`}><TokenIcon token="bless" size={16} /></span>
          <span className="chaosbag-bc-label">Bendito</span>
          <span className="chaosbag-bc-count">{blessInBag}/{BLESS_CURSE_MAX}</span>
          <button onClick={handleAddBless} className="btn btn-xs btn-success" disabled={blessAvailable <= 0 || boardLocked}>+ Añadir</button>
          <button onClick={handleRemoveBless} className="btn btn-xs btn-danger" disabled={!bagSummary['bless'] || boardLocked}>− Quitar</button>
        </div>
        <div className="chaosbag-bc-row">
          <span className={`chaosbag-token chaosbag-token-sm token-curse`}><TokenIcon token="curse" size={16} /></span>
          <span className="chaosbag-bc-label">Maldito</span>
          <span className="chaosbag-bc-count">{curseInBag}/{BLESS_CURSE_MAX}</span>
          <button onClick={handleAddCurse} className="btn btn-xs btn-success" disabled={curseAvailable <= 0 || boardLocked}>+ Añadir</button>
          <button onClick={handleRemoveCurse} className="btn btn-xs btn-danger" disabled={!bagSummary['curse'] || boardLocked}>− Quitar</button>
        </div>
      </div>

      {/* Bag contents (collapsed) */}
      <div className="chaosbag-bag-contents">
        <div className="chaosbag-bag-tokens">
          {ALL_TOKEN_TYPES.filter(t => bagSummary[t]).map(t => (
            <div key={t} className="chaosbag-summary-chip">
              <span className={`chaosbag-token chaosbag-token-xs ${tokenClass(t)}`}>
                {tokenLabel(t, 22)}
              </span>
              <span className="chaosbag-summary-count">×{bagSummary[t]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Management section (accessible to all) */}
      <div className="chaosbag-manage">
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={() => setShowManage(!showManage)}
        >
          {showManage ? 'Cerrar gestión' : '⚙ Gestionar bolsa'}
        </button>

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
                  <button
                    key={i}
                    className={`chaosbag-token chaosbag-token-manage chaosbag-token-removable ${tokenClass(token)}`}
                    onClick={() => !boardLocked && handleRemoveToken(i)}
                    disabled={boardLocked}
                    title="Quitar permanentemente"
                  >
                    {tokenLabel(token, 28)}
                  </button>
                ))}
              </div>
            </div>

            <div className="chaosbag-manage-lock">
              <label>Sellar ficha (pulsa para sellar):</label>
              <div className="chaosbag-manage-tokens">
                {bag.map((token, i) => (
                  <button
                    key={i}
                    className={`chaosbag-token chaosbag-token-manage ${tokenClass(token)}`}
                    onClick={() => !boardLocked && handleLock(i)}
                    disabled={boardLocked}
                    title="Sellar temporalmente"
                  >
                    {tokenLabel(token, 28)}
                  </button>
                ))}
              </div>
            </div>

            {isOwnerOrAdmin && (
              <div className="chaosbag-manage-reset">
                <button onClick={handleReset} className="btn btn-sm btn-danger" disabled={boardLocked}>
                  🔄 Resetear a configuración inicial
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Locked/sealed tokens */}
      {locked.length > 0 && (
        <div className="chaosbag-locked">
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => setShowLocked(!showLocked)}
          >
            {showLocked ? 'Ocultar selladas' : `🔒 Fichas selladas (${locked.length})`}
          </button>
          {showLocked && (
            <div className="chaosbag-locked-tokens">
              {locked.map((token, i) => (
                <button
                  key={i}
                  className={`chaosbag-token chaosbag-token-manage chaosbag-token-locked ${tokenClass(token)}`}
                  onClick={() => !boardLocked && handleUnlock(i)}
                  disabled={boardLocked}
                  title="Devolver a la bolsa"
                >
                  {tokenLabel(token, 28)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Draw history */}
      <div className="chaosbag-history">
        <button
          type="button"
          className="btn btn-sm btn-secondary counter-history-toggle"
          onClick={() => setShowHistory(!showHistory)}
        >
          {showHistory ? 'Ocultar historial' : 'Ver historial'} ({history.length})
        </button>
        {showHistory && (
          <div className="chaosbag-history-list">
            {history.length === 0 && <p className="text-muted">Sin tiradas registradas</p>}
            {history.map(entry => (
              <div key={entry.id} className="chaosbag-history-entry">
                <div className="chaosbag-history-tokens">
                  {entry.tokens_drawn.map((t, i) => (
                    <span key={i} className={`chaosbag-token chaosbag-token-xs ${tokenClass(t)}`}>
                      {tokenLabel(t, 12)}
                    </span>
                  ))}
                </div>
                <span className="chaosbag-history-author">{entry.author_name}</span>
                <span className="chaosbag-history-time">{formatTime(entry.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
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
