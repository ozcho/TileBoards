import { useState, useEffect, useRef } from 'react';

const DIE_SIDES = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100 };
const ALL_DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

const DIE_EMOJI = {
  d4: '▲',
  d6: '⬡',
  d8: '◆',
  d10: '◉',
  d12: '⬟',
  d20: '⬠',
  d100: '%',
};

export default function DiceTile({ tile, socket, isOwnerOrAdmin, user, guestName, boardLocked }) {
  const availableDice = tile.config?.availableDice ?? ALL_DICE;
  const lastRoll = tile.state?.lastRoll ?? null;
  const history = tile.state?.history ?? [];

  const [animating, setAnimating] = useState(false);
  const prevRollRef = useRef(null);

  const authorName = user?.name || guestName || 'Anónimo';

  // Trigger animation whenever lastRoll changes
  useEffect(() => {
    if (!lastRoll) return;
    const key = lastRoll.rolledAt;
    if (key !== prevRollRef.current) {
      prevRollRef.current = key;
      setAnimating(true);
      const t = setTimeout(() => setAnimating(false), 600);
      return () => clearTimeout(t);
    }
  }, [lastRoll]);

  const handleRoll = (diceType) => {
    if (boardLocked || !socket) return;
    socket.emit('dice-roll', { tileId: tile.id, diceType, authorName });
  };

  const formatTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="tile tile-dice">
      <h3 className="tile-label">{tile.label || 'Dados'}</h3>

      <div className="dice-buttons">
        {availableDice.filter(d => DIE_SIDES[d]).map(die => (
          <button
            key={die}
            onClick={() => handleRoll(die)}
            className="btn btn-dice"
            disabled={boardLocked}
            title={`Tirar ${die}`}
          >
            <span className="dice-btn-icon">{DIE_EMOJI[die]}</span>
            <span className="dice-btn-label">{die}</span>
          </button>
        ))}
      </div>

      {lastRoll ? (
        <div className={`dice-result ${animating ? 'dice-result-animate' : ''}`}>
          <div className="dice-result-value">{lastRoll.value}</div>
          <div className="dice-result-meta">
            <span className="dice-result-type">{lastRoll.diceType}</span>
            <span className="dice-result-dot">·</span>
            <span className="dice-result-author">{lastRoll.authorName}</span>
            <span className="dice-result-dot">·</span>
            <span className="dice-result-time">{formatTime(lastRoll.rolledAt)}</span>
          </div>
        </div>
      ) : (
        <div className="tile-empty">Ninguna tirada todavía</div>
      )}

      {history.length > 1 && (
        <div className="dice-history">
          {history.slice(1, 6).map((roll, i) => (
            <div key={i} className="dice-history-entry">
              <span className="dice-history-type">{roll.diceType}</span>
              <span className="dice-history-value">{roll.value}</span>
              <span className="dice-history-author">{roll.authorName}</span>
              <span className="dice-history-time">{formatTime(roll.rolledAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
