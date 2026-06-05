import { useEffect, useMemo, useRef, useState } from 'react';
import iconBrownWorm from '../../tokens/jungle-icons-clean/icon-brown-worm.png';
import iconGreenDiamond from '../../tokens/jungle-icons-clean/icon-green-diamond.png';
import iconMagentaCrescent from '../../tokens/jungle-icons-clean/icon-magenta-crescent.png';
import iconMaroonHourglass from '../../tokens/jungle-icons-clean/icon-maroon-hourglass.png';
import iconNavyHat from '../../tokens/jungle-icons-clean/icon-navy-hat.png';
import iconOliveSlash from '../../tokens/jungle-icons-clean/icon-olive-slash.png';
import iconOrangeHeart from '../../tokens/jungle-icons-clean/icon-orange-heart.png';
import iconPurpleTriangle from '../../tokens/jungle-icons-clean/icon-purple-triangle.png';
import iconRedSquare from '../../tokens/jungle-icons-clean/icon-red-square.png';
import iconYellowRing from '../../tokens/jungle-icons-clean/icon-yellow-ring.png';

const ARKHAM_ICON_BY_KEY = {
  'brown-worm': iconBrownWorm,
  'green-diamond': iconGreenDiamond,
  'magenta-crescent': iconMagentaCrescent,
  'maroon-hourglass': iconMaroonHourglass,
  'navy-hat': iconNavyHat,
  'olive-slash': iconOliveSlash,
  'orange-heart': iconOrangeHeart,
  'purple-triangle': iconPurpleTriangle,
  'red-square': iconRedSquare,
  'yellow-ring': iconYellowRing
};

function clampCardText(value) {
  return Array.from(String(value || '').trim()).slice(0, 16).join('');
}

function normalizeCards(config) {
  const configurations = Array.isArray(config?.configurations) ? config.configurations : [];
  const selected = configurations.find(c => c.id === config?.selectedConfigId) || configurations[0] || null;
  const rawCards = selected
    ? (Array.isArray(selected.cards) ? selected.cards : [])
    : (Array.isArray(config?.cards) ? config.cards : []);
  const countsMap =
    config?.selectedCardCountsByConfigId && typeof config.selectedCardCountsByConfigId === 'object'
      ? config.selectedCardCountsByConfigId
      : {};
  const legacySubsetMap =
    config?.selectedCardIdsByConfigId && typeof config.selectedCardIdsByConfigId === 'object'
      ? config.selectedCardIdsByConfigId
      : {};
  const selectedConfigId = String(selected?.id || '').trim();
  const hasCounts = selectedConfigId
    && Object.prototype.hasOwnProperty.call(countsMap, selectedConfigId)
    && countsMap[selectedConfigId]
    && typeof countsMap[selectedConfigId] === 'object';
  const hasLegacySubset = selectedConfigId && Object.prototype.hasOwnProperty.call(legacySubsetMap, selectedConfigId);
  const legacySet = hasLegacySubset
    ? new Set(
      (Array.isArray(legacySubsetMap[selectedConfigId]) ? legacySubsetMap[selectedConfigId] : [])
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    )
    : null;

  const normalizedCards = rawCards
    .map((card) => {
      const id = String(card?.id || '').trim();
      const text = clampCardText(card?.text || '');
      if (!id || !text) return null;
      return { id, text };
    })
    .filter(Boolean);

  const cards = [];
  normalizedCards.forEach((card) => {
    let count = 1;

    if (hasCounts) {
      if (Object.prototype.hasOwnProperty.call(countsMap[selectedConfigId], card.id)) {
        const raw = parseInt(countsMap[selectedConfigId][card.id], 10);
        count = Number.isFinite(raw) ? Math.max(0, raw) : 1;
      }
    } else if (legacySet) {
      count = legacySet.has(card.id) ? 1 : 0;
    }

    for (let i = 0; i < count; i += 1) {
      cards.push(card);
    }
  });

  return {
    selectedName: String(selected?.name || '').trim(),
    cards
  };
}

function renderCardContent(text, imageClassName = 'random-card-icon') {
  const key = String(text || '').trim().toLowerCase();
  const src = ARKHAM_ICON_BY_KEY[key];
  if (src) {
    return <img className={imageClassName} src={src} alt={key} />;
  }
  return text;
}

export default function RandomCardsTile({ tile, socket, user, guestName, boardLocked }) {
  const { selectedName, cards } = useMemo(() => normalizeCards(tile.config), [tile.config]);
  const state = tile.state || {};
  const remaining = Array.isArray(state.remaining) ? state.remaining : cards.map(c => c.id);
  const drawn = Array.isArray(state.drawn) ? state.drawn : [];
  const lastDraw = state.lastDraw || null;
  const history = Array.isArray(state.history) ? state.history : [];

  const [drawCount, setDrawCount] = useState(1);
  const [animating, setAnimating] = useState(false);
  const prevDrawRef = useRef(null);

  const authorName = user?.name || guestName || 'Anónimo';
  const totalCards = cards.length;
  const remainingCount = remaining.length;

  useEffect(() => {
    // No longer limit by remainingCount since Robar does fresh draw with reshuffle
  }, []);

  useEffect(() => {
    if (!lastDraw) return;
    if (lastDraw.drawnAt !== prevDrawRef.current) {
      prevDrawRef.current = lastDraw.drawnAt;
      setAnimating(true);
      const t = setTimeout(() => setAnimating(false), 650);
      return () => clearTimeout(t);
    }
  }, [lastDraw]);

  const formatTime = (iso) =>
    new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const handleDraw = () => {
    if (!socket || boardLocked) return;
    socket.emit('random-cards-draw-fresh', { tileId: tile.id, count: drawCount, authorName });
  };

  const handleDrawAnother = () => {
    if (!socket || boardLocked || remainingCount === 0) return;
    socket.emit('random-cards-draw', { tileId: tile.id, count: 1, authorName });
  };

  const handleReset = () => {
    if (!socket || boardLocked || totalCards === 0) return;
    socket.emit('random-cards-reset', { tileId: tile.id });
  };

  if (cards.length === 0) {
    return (
      <div className="tile tile-random-cards">
        <h3 className="tile-label">{tile.label || 'Cartas Aleatorias'}</h3>
        <div className="tile-empty">No hay cartas configuradas.</div>
      </div>
    );
  }

  return (
    <div className="tile tile-random-cards">
      <h3 className="tile-label">{tile.label || 'Cartas Aleatorias'}</h3>

      {selectedName && (
        <div className="random-cards-active-config">Configuracion: <strong>{selectedName}</strong></div>
      )}

      <div className="random-cards-meta">
        <span>Quedan <strong>{remainingCount}</strong> de <strong>{totalCards}</strong></span>
      </div>

      <div
        className={`random-cards-drawn-area${animating ? ' random-cards-drawn-animate' : ''}`}
        onClick={handleDraw}
        role="button"
        tabIndex={boardLocked ? -1 : 0}
        aria-disabled={boardLocked}
        onKeyDown={(e) => {
          if (boardLocked) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleDraw();
          }
        }}
      >
        {drawn.length > 0 ? (
          <div className="random-cards-drawn-list">
            {drawn.map((cardId, idx) => {
              const card = cards.find(c => c.id === cardId);
              return (
                <div key={`${cardId}-${idx}`} className="random-card-chip">{renderCardContent(card?.text || '')}</div>
              );
            })}
          </div>
        ) : (
          <div className="random-cards-empty">Sin carta robada</div>
        )}
      </div>

      <div className="random-cards-controls">
        <div className="dice-stepper">
          <button
            className="btn btn-dice-step"
            onClick={() => setDrawCount((v) => Math.max(1, v - 1))}
            disabled={boardLocked || drawCount <= 1}
          >−</button>
          <span className="dice-stepper-value">{drawCount}</span>
          <button
            className="btn btn-dice-step"
            onClick={() => setDrawCount((v) => Math.min(9, v + 1))}
            disabled={boardLocked || drawCount >= 9}
          >+</button>
        </div>

        <button
          className="btn btn-primary btn-dice-roll"
          onClick={handleDraw}
          disabled={boardLocked}
        >
          🃏 Robar {drawCount}
        </button>

        <button
          className="btn btn-secondary btn-sm"
          onClick={handleDrawAnother}
          disabled={boardLocked || remainingCount === 0}
        >
          🃏 Robar otra
        </button>

        <button
          className="btn btn-secondary btn-sm"
          onClick={handleReset}
          disabled={boardLocked}
        >
          🔀 Barajar
        </button>
      </div>

      {lastDraw && (
        <div className="dice-result-meta">
          <span className="dice-result-author">{lastDraw.authorName}</span>
          <span className="dice-result-dot">·</span>
          <span className="dice-result-time">{formatTime(lastDraw.drawnAt)}</span>
        </div>
      )}

      {history.length > 1 && (
        <div className="dice-history-wrapper">
          <div className="dice-history">
            {history.slice(1, 6).map((entry, idx) => (
              <div key={`${entry.drawnAt || idx}-${idx}`} className="dice-history-entry">
                <span className="dice-history-author">{entry.authorName}</span>
                <span className="dice-result-dot">·</span>
                <div className="random-cards-history-list">
                  {(entry.cards || []).map((card, cardIndex) => (
                    <span key={`${card.cardId}-${cardIndex}`} className="random-card-history-chip">
                      {renderCardContent(card.text, 'random-card-history-icon')}
                    </span>
                  ))}
                </div>
                <span className="dice-history-time">{formatTime(entry.drawnAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
