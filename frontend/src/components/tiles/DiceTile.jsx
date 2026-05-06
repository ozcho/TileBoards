import { useState, useEffect, useRef } from 'react';

const ALL_DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];
const DIE_SIDES = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100 };

// Visual center Y of each shape for text placement (viewBox 0 0 50 50)
const TEXT_Y = { d4: '31', d6: '25', d8: '25', d10: '27', d12: '25', d20: '25', d100: '25' };

function DieShape({ type }) {
  switch (type) {
    case 'd4':   return <polygon points="25,4 47,44 3,44" />;
    case 'd6':   return <rect x="3" y="3" width="44" height="44" rx="5" />;
    case 'd8':   return <polygon points="25,3 47,25 25,47 3,25" />;
    case 'd10':  return <polygon points="25,3 47,20 40,47 10,47 3,20" />;
    case 'd12':  return <polygon points="25,3 46,18 38,43 12,43 4,18" />;
    case 'd20':  return <polygon points="25,3 44,14 44,36 25,47 6,36 6,14" />;
    case 'd100': return <circle cx="25" cy="25" r="22" />;
    default:     return null;
  }
}

// Sides number shown inside the shape (selector mode)
const SIDES_LABEL = { d4: '4', d6: '6', d8: '8', d10: '10', d12: '12', d20: '20', d100: '100' };

function DieIcon({ type, value, size = 44, isResult = false }) {
  const text = value !== undefined ? String(value) : SIDES_LABEL[type] || type;
  const len = text.length;
  const fontSize = isResult
    ? (len >= 3 ? '11' : len === 2 ? '14' : '17')
    : (len >= 3 ? '10' : len === 2 ? '13' : '15');

  return (
    <svg
      viewBox="0 0 50 50"
      width={size}
      height={size}
      className={`die-svg die-svg-${type}${isResult ? ' die-svg-result' : ''}`}
    >
      <DieShape type={type} />
      <text
        x="25"
        y={TEXT_Y[type] || '25'}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        className="die-svg-text"
      >
        {text}
      </text>
    </svg>
  );
}

export default function DiceTile({ tile, socket, isOwnerOrAdmin, user, guestName, boardLocked }) {
  const availableDice = tile.config?.availableDice ?? ALL_DICE;
  const lastRoll = tile.state?.lastRoll ?? null;
  const history = tile.state?.history ?? [];

  const initCounts = () => Object.fromEntries(availableDice.map(d => [d, 0]));
  const [counts, setCounts] = useState(initCounts);
  const [animating, setAnimating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const prevRollRef = useRef(null);

  const authorName = user?.name || guestName || 'Anónimo';

  useEffect(() => {
    if (!lastRoll) return;
    const key = lastRoll.rolledAt;
    if (key !== prevRollRef.current) {
      prevRollRef.current = key;
      setAnimating(true);
      const t = setTimeout(() => setAnimating(false), 700);
      return () => clearTimeout(t);
    }
  }, [lastRoll]);

  const totalDice = availableDice.reduce((s, d) => s + (counts[d] || 0), 0);

  const setCount = (die, delta) => {
    setCounts(prev => ({
      ...prev,
      [die]: Math.max(0, Math.min(9, (prev[die] || 0) + delta)),
    }));
  };

  const handleRoll = () => {
    if (boardLocked || !socket || totalDice === 0) return;
    const dice = availableDice
      .filter(d => counts[d] > 0)
      .map(d => ({ type: d, count: counts[d] }));
    socket.emit('dice-roll', { tileId: tile.id, dice, authorName });
  };

  const formatTime = (iso) =>
    new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="tile tile-dice">
      <h3 className="tile-label">{tile.label || 'Dados'}</h3>

      <div className="dice-selector-grid">
        {availableDice.filter(d => DIE_SIDES[d]).map(die => (
          <div
            key={die}
            className={`dice-selector-card${counts[die] > 0 ? ' dice-selector-card-active' : ''}`}
          >
            <DieIcon type={die} size={44} />
            <span className="dice-type-label">{die}</span>
            <div className="dice-stepper">
              <button
                className="btn btn-dice-step"
                onClick={() => setCount(die, -1)}
                disabled={boardLocked || counts[die] === 0}
              >−</button>
              <span className="dice-stepper-value">{counts[die]}</span>
              <button
                className="btn btn-dice-step"
                onClick={() => setCount(die, +1)}
                disabled={boardLocked || counts[die] >= 9}
              >+</button>
            </div>
          </div>
        ))}
      </div>

      <button
        className="btn btn-primary btn-dice-roll"
        onClick={handleRoll}
        disabled={boardLocked || totalDice === 0}
      >
        🎲 {totalDice > 0
          ? `Tirar ${totalDice} dado${totalDice !== 1 ? 's' : ''}`
          : 'Selecciona dados'}
      </button>

      {lastRoll ? (
        <div className={`dice-result-block${animating ? ' dice-result-animate' : ''}`}>
          <div className="dice-result-meta">
            <span className="dice-result-author">{lastRoll.authorName}</span>
            <span className="dice-result-dot">·</span>
            <span className="dice-result-time">{formatTime(lastRoll.rolledAt)}</span>
            {lastRoll.total !== undefined && (
              <>
                <span className="dice-result-dot">·</span>
                <span className="dice-result-total">Total: <strong>{lastRoll.total}</strong></span>
              </>
            )}
          </div>
          <div className="dice-result-dice">
            {(lastRoll.dice || []).map((r, i) => (
              <DieIcon key={i} type={r.type} value={r.value} size={52} isResult />
            ))}
          </div>
        </div>
      ) : (
        <div className="tile-empty">Ninguna tirada todavía</div>
      )}

      {history.length > 1 && (
        <div className="dice-history-wrapper">
          <button
            type="button"
            className={`btn btn-xs ${showHistory ? 'btn-secondary' : 'btn-ghost'}`}
            onClick={() => setShowHistory(v => !v)}
          >
            {showHistory ? 'Ocultar historial' : 'Ver historial'} ({history.length - 1})
          </button>
          {showHistory && (
            <div className="dice-history">
              {history.slice(1, 10).map((roll, i) => (
                <div key={i} className="dice-history-entry">
                  <div className="dice-history-dice">
                    {(roll.dice || []).map((r, j) => (
                      <DieIcon key={j} type={r.type} value={r.value} size={24} isResult />
                    ))}
                  </div>
                  {roll.total !== undefined && (
                    <span className="dice-history-total">= {roll.total}</span>
                  )}
                  <span className="dice-history-author">{roll.authorName}</span>
                  <span className="dice-history-time">{formatTime(roll.rolledAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
