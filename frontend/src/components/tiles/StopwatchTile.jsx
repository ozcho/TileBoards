import { useState, useEffect } from 'react';

export default function StopwatchTile({ tile, socket, isOwnerOrAdmin }) {
  const startedAt = tile.state?.startedAt || null;
  const paused = tile.state?.paused || false;
  const pausedElapsed = tile.state?.pausedElapsed || 0;

  const [elapsed, setElapsed] = useState(pausedElapsed);

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      return;
    }

    if (paused) {
      setElapsed(pausedElapsed);
      return;
    }

    const update = () => {
      const base = pausedElapsed;
      const sinceStart = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      setElapsed(base + sinceStart);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAt, paused, pausedElapsed]);

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  const isRunning = startedAt && !paused;

  const handleStart = () => socket.emit('stopwatch-start', { tileId: tile.id });
  const handlePause = () => socket.emit('stopwatch-pause', { tileId: tile.id });
  const handleReset = () => socket.emit('stopwatch-reset', { tileId: tile.id });

  return (
    <div className="tile tile-countdown">
      <h3 className="tile-label">{tile.label || 'Cronómetro'}</h3>
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
      {isOwnerOrAdmin && (
        <div className="countdown-controls">
          {!isRunning ? (
            <button onClick={handleStart} className="btn btn-primary btn-sm">
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
