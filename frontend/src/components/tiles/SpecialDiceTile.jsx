import { useEffect, useMemo, useRef, useState } from 'react';

function textLength(value) {
  return Array.from(value || '').length;
}

function clampFaceText(value) {
  return Array.from(value || '').slice(0, 6).join('');
}

function normalizeDieColor(value, fallback = '#3b82f6') {
  const color = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

function getContrastColor(hex) {
  const normalized = normalizeDieColor(hex, '#3b82f6');
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 145 ? '#111827' : '#ffffff';
}

// sides=2 → circle
// sides=3,4 → triangle (3 vertices)
// sides=5,6 → square (4 vertices)
// sides=7,8 → pentagon (5 vertices) … and so on: vertices = floor((sides+3)/2)
// cap at 12 vertices, beyond that use circle
function sidestoVertices(sides) {
  if (sides <= 2) return 0; // circle
  const v = Math.floor((sides + 3) / 2);
  return v > 12 ? 0 : v; // 0 = circle
}

function SpecialDieIcon({ sides, color, value, size = 44, isResult = false }) {
  const cx = 25, cy = 25, r = 20;
  const fillColor = `${color}${isResult ? 'aa' : '26'}`; // ~67% / ~15% opacity
  const strokeColor = color;

  const textContent = value !== undefined ? String(value) : String(sides);
  const len = Array.from(textContent).length;
  const fontSize = isResult
    ? (len >= 4 ? '8' : len === 3 ? '10' : len === 2 ? '12' : '14')
    : (len >= 3 ? '9'  : len === 2 ? '11' : '13');

  const vertices = sidestoVertices(sides);
  let shape;
  if (vertices === 0) {
    shape = <circle cx={cx} cy={cy} r={r} fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />;
  } else {
    const points = [];
    for (let i = 0; i < vertices; i++) {
      // Start from top (-90°) so the shape is upright
      const angle = (2 * Math.PI * i / vertices) - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }
    shape = <polygon points={points.join(' ')} fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />;
  }

  // For result: contrast against the filled shape color.
  // For selector: the fill is almost transparent so contrast against the die color itself
  // (which is the stroke/text color) — use an outline to stay readable on any bg.
  const textFill = isResult ? getContrastColor(color) : color;
  const textStroke = isResult ? 'none' : getContrastColor(color);

  return (
    <svg viewBox="0 0 50 50" width={size} height={size} className="special-die-svg">
      {shape}
      <text
        x="25"
        y="25"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontWeight="800"
        fontFamily="inherit"
        fill={textFill}
        stroke={textStroke}
        strokeWidth={isResult ? '0' : '3'}
        paintOrder="stroke fill"
        style={{ pointerEvents: 'none' }}
      >
        {textContent}
      </text>
    </svg>
  );
}

function normalizeDiceConfig(rawConfig) {
  const config = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
  const configurations = Array.isArray(config.configurations) ? config.configurations : [];
  const selected = configurations.find(c => c.id === config.selectedConfigId) || configurations[0] || null;

  if (!selected) {
    return { selectedConfig: null, dice: [] };
  }

  const dice = (Array.isArray(selected.dice) ? selected.dice : [])
    .map((die) => {
      const sides = Math.max(2, Math.min(100, parseInt(die?.sides, 10) || 0));
      const faces = Array(sides).fill('').map((_, i) => clampFaceText(die?.faces?.[i] || ''));
      return {
        id: die?.id || crypto.randomUUID(),
        title: (die?.title || '').trim() || 'Dado',
        color: normalizeDieColor(die?.color, '#3b82f6'),
        sides,
        faces
      };
    });

  return { selectedConfig: selected, dice };
}

export default function SpecialDiceTile({ tile, socket, user, guestName, boardLocked }) {
  const { selectedConfig, dice } = useMemo(() => normalizeDiceConfig(tile.config), [tile.config]);
  const lastRoll = tile.state?.lastRoll ?? null;
  const history = tile.state?.history ?? [];

  const initCounts = () => Object.fromEntries(dice.map(d => [d.id, 0]));
  const [counts, setCounts] = useState(initCounts);
  const [animating, setAnimating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const prevRollRef = useRef(null);

  const authorName = user?.name || guestName || 'Anónimo';

  useEffect(() => {
    setCounts(initCounts());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tile.id, tile.config]);

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

  const totalDice = dice.reduce((sum, die) => sum + (counts[die.id] || 0), 0);

  const setCount = (dieId, delta) => {
    setCounts(prev => ({
      ...prev,
      [dieId]: Math.max(0, Math.min(9, (prev[dieId] || 0) + delta))
    }));
  };

  const handleRoll = () => {
    if (boardLocked || !socket || totalDice === 0 || !selectedConfig) return;

    const selectedDice = dice
      .filter(d => counts[d.id] > 0)
      .map(d => ({ id: d.id, count: counts[d.id] }));

    socket.emit('special-dice-roll', {
      tileId: tile.id,
      configId: selectedConfig.id,
      dice: selectedDice,
      authorName
    });
  };

  const formatTime = (iso) =>
    new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (!selectedConfig || dice.length === 0) {
    return (
      <div className="tile tile-dice">
        <h3 className="tile-label">{tile.label || 'Dados Especiales'}</h3>
        <div className="tile-empty">No hay una configuracion de dados valida.</div>
      </div>
    );
  }

  return (
    <div className="tile tile-dice tile-special-dice">
      <h3 className="tile-label">{tile.label || 'Dados Especiales'}</h3>
      <div className="special-dice-active-config">Configuracion: <strong>{selectedConfig.name}</strong></div>

      <div className="special-dice-selector-grid">
        {dice.map((die) => (
          <div
            key={die.id}
            className={`special-dice-selector-card${counts[die.id] > 0 ? ' special-dice-selector-card-active' : ''}`}
            style={{ borderColor: counts[die.id] > 0 ? die.color : undefined }}
          >
            <SpecialDieIcon sides={die.sides} color={die.color} size={44} />
            <div className="special-dice-die-title" style={{ color: die.color }}>{die.title}</div>
            <div className="dice-stepper">
              <button
                className="btn btn-dice-step"
                onClick={() => setCount(die.id, -1)}
                disabled={boardLocked || counts[die.id] === 0}
              >−</button>
              <span className="dice-stepper-value">{counts[die.id] || 0}</span>
              <button
                className="btn btn-dice-step"
                onClick={() => setCount(die.id, +1)}
                disabled={boardLocked || counts[die.id] >= 9}
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
          </div>
          <div className="special-dice-result-list">
            {(lastRoll.dice || []).map((r, i) => {
              const dieColor = normalizeDieColor(r.color, '#3b82f6');
              const dieObj = dice.find(d => d.id === r.dieId);
              const dieSides = r.sides ?? dieObj?.sides ?? 6;
              return (
              <div key={i} className="special-dice-result-item">
                  <SpecialDieIcon
                    sides={dieSides}
                    color={dieColor}
                    value={r.value ?? ''}
                    size={52}
                    isResult
                  />
                  <span className="special-dice-result-die">{r.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="tile-empty">Ninguna tirada todavia</div>
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
                <div key={i} className="special-dice-history-entry">
                  <div className="special-dice-history-dice">
                    {(roll.dice || []).map((r, j) => {
                      const hColor = normalizeDieColor(r.color, '#3b82f6');
                      const hSides = r.sides ?? dice.find(d => d.id === r.dieId)?.sides ?? 6;
                      return (
                        <div key={j} className="special-dice-history-chip">
                          <SpecialDieIcon sides={hSides} color={hColor} value={r.value ?? ''} size={28} isResult />
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>{r.title}</span>
                        </div>
                      );
                    })}
                  </div>
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
