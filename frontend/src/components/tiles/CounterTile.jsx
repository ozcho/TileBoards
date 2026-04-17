import { useState, useEffect } from 'react';

export default function CounterTile({ tile, socket, isOwnerOrAdmin, user, guestName }) {
  const value = tile.state?.value || 0;
  const historyVisibility = tile.config?.historyVisibility || 'none';
  const canSeeHistory = historyVisibility === 'all' || (historyVisibility === 'owner_admin' && isOwnerOrAdmin);

  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!canSeeHistory || !socket) return;

    socket.emit('counter-history-get', { tileId: tile.id });

    const handleList = ({ tileId, history: h }) => {
      if (tileId === tile.id) setHistory(h);
    };
    const handleAdded = ({ tileId, entry }) => {
      if (tileId === tile.id) setHistory(prev => [entry, ...prev].slice(0, 200));
    };

    socket.on('counter-history-list', handleList);
    socket.on('counter-history-added', handleAdded);

    return () => {
      socket.off('counter-history-list', handleList);
      socket.off('counter-history-added', handleAdded);
    };
  }, [tile.id, socket, canSeeHistory]);

  const authorName = user?.name || guestName || 'Anónimo';

  const handleChange = (delta) => {
    socket.emit('counter-update', { tileId: tile.id, delta, authorName });
  };

  const formatTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit' });
  };

  return (
    <div className="tile tile-counter">
      <h3 className="tile-label">{tile.label || 'Contador'}</h3>
      <div className="counter-display">
        <span className="counter-value">{value}</span>
      </div>
      <div className="counter-buttons">
        <button onClick={() => handleChange(-5)} className="btn btn-counter btn-minus-big">-5</button>
        <button onClick={() => handleChange(-1)} className="btn btn-counter btn-minus">-1</button>
        <button onClick={() => handleChange(1)} className="btn btn-counter btn-plus">+1</button>
        <button onClick={() => handleChange(5)} className="btn btn-counter btn-plus-big">+5</button>
      </div>

      {canSeeHistory && (
        <div className="counter-history">
          <button
            type="button"
            className="btn btn-sm btn-secondary counter-history-toggle"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? 'Ocultar historial' : 'Ver historial'} ({history.length})
          </button>
          {showHistory && (
            <div className="counter-history-list">
              {history.length === 0 && <p className="text-muted">Sin cambios registrados</p>}
              {history.map(entry => (
                <div key={entry.id} className="counter-history-entry">
                  <span className={`counter-history-delta ${entry.delta > 0 ? 'positive' : 'negative'}`}>
                    {entry.delta > 0 ? '+' : ''}{entry.delta}
                  </span>
                  <span className="counter-history-value">→ {entry.value_after}</span>
                  <span className="counter-history-author">{entry.author_name}</span>
                  <span className="counter-history-time">{formatTime(entry.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
