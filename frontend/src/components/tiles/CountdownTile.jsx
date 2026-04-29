import { useState, useEffect, useRef } from 'react';

export default function CountdownTile({ tile, socket, isOwnerOrAdmin }) {
  const canControl = isOwnerOrAdmin || tile.config?.showControlsToAll;
  const configH = tile.config?.hours || 0;
  const configM = tile.config?.minutes || 0;
  const configS = tile.config?.seconds || 0;
  const lockOnZero = tile.config?.lockOnZero || false;
  const totalConfigSeconds = configH * 3600 + configM * 60 + configS;

  // State from server: startedAt (ISO timestamp) or null
  const startedAt = tile.state?.startedAt || null;
  const paused = tile.state?.paused || false;
  const pausedRemaining = tile.state?.pausedRemaining || 0;

  const [remaining, setRemaining] = useState(totalConfigSeconds);
  const [finished, setFinished] = useState(false);
  const finishedEmittedRef = useRef(false);

  useEffect(() => {
    if (!startedAt) {
      setRemaining(totalConfigSeconds);
      setFinished(false);
      finishedEmittedRef.current = false;
      return;
    }

    if (paused) {
      setRemaining(pausedRemaining);
      setFinished(false);
      return;
    }

    const update = () => {
      const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      const left = totalConfigSeconds - elapsed;
      if (left <= 0) {
        setRemaining(0);
        setFinished(true);
      } else {
        setRemaining(left);
        setFinished(false);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAt, paused, pausedRemaining, totalConfigSeconds]);

  // Emit countdown-finished once when it reaches 0 with lockOnZero enabled
  useEffect(() => {
    if (finished && lockOnZero && socket && !finishedEmittedRef.current) {
      finishedEmittedRef.current = true;
      socket.emit('countdown-finished', { tileId: tile.id });
    }
  }, [finished, lockOnZero, socket, tile.id]);

  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;

  const handleStart = () => {
    socket.emit('countdown-start', { tileId: tile.id });
  };
  const handlePause = () => {
    socket.emit('countdown-pause', { tileId: tile.id });
  };
  const handleReset = () => {
    socket.emit('countdown-reset', { tileId: tile.id });
  };

  const isRunning = startedAt && !paused && !finished;

  return (
    <div className="tile tile-countdown">
      <h3 className="tile-label">{tile.label || 'Cuenta Atrás'}</h3>
      {finished ? (
        <div className="countdown-finished">🎉 ¡Tiempo!</div>
      ) : (
        <div className="countdown-display">
          <div className="countdown-unit">
            <span className="countdown-value">{String(hours).padStart(2, '0')}</span>
            <span className="countdown-unit-label">horas</span>
          </div>
          <div className="countdown-unit">
            <span className="countdown-value">{String(minutes).padStart(2, '0')}</span>
            <span className="countdown-unit-label">min</span>
          </div>
          <div className="countdown-unit">
            <span className="countdown-value">{String(seconds).padStart(2, '0')}</span>
            <span className="countdown-unit-label">seg</span>
          </div>
        </div>
      )}
      {canControl && (
        <div className="countdown-controls">
          {!isRunning ? (
            <button onClick={handleStart} className="btn btn-primary btn-sm" disabled={finished && !startedAt}>
              {paused ? '▶ Reanudar' : '▶ Iniciar'}
            </button>
          ) : (
            <button onClick={handlePause} className="btn btn-secondary btn-sm">⏸ Pausar</button>
          )}
          <button onClick={handleReset} className="btn btn-sm">↺ Reset</button>
        </div>
      )}
    </div>
  );
}
