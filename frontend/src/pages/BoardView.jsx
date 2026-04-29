import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import CountdownTile from '../components/tiles/CountdownTile';
import StopwatchTile from '../components/tiles/StopwatchTile';
import ClockTile from '../components/tiles/ClockTile';
import CounterTile from '../components/tiles/CounterTile';
import MessageBoardTile from '../components/tiles/MessageBoardTile';
import ChaosBagTile from '../components/tiles/ChaosBagTile';
import ArkhamBagTile from '../components/tiles/ArkhamBagTile';

export default function BoardView({ board: initialBoard, user, guestName }) {
  const [tiles, setTiles] = useState(initialBoard.tiles || []);
  const [boardName, setBoardName] = useState(initialBoard.name);
  const [connected, setConnected] = useState(false);
  const [boardLocked, setBoardLocked] = useState(false);
  const navigate = useNavigate();
  const boardId = initialBoard.id;
  const wakeLockRef = useRef(null);
  const wakeLockWanted = useRef(false);  // intención del usuario, independiente del sentinel
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const wakeLockSupported = 'wakeLock' in navigator;

  const acquireWakeLock = async () => {
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setWakeLockActive(true);
      wakeLockRef.current.addEventListener('release', () => {
        // El SO liberó el sentinel (p.ej. al ir a background) — no cambiamos la intención
        wakeLockRef.current = null;
      });
    } catch {
      wakeLockWanted.current = false;
      setWakeLockActive(false);
    }
  };

  const toggleWakeLock = async () => {
    if (wakeLockWanted.current) {
      // El usuario quiere desactivarlo
      wakeLockWanted.current = false;
      setWakeLockActive(false);
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } else {
      wakeLockWanted.current = true;
      await acquireWakeLock();
    }
  };

  // Re-adquirir al volver el foco si el usuario lo tenía activo
  useEffect(() => {
    const onVisibility = async () => {
      if (document.visibilityState === 'visible' && wakeLockWanted.current && !wakeLockRef.current) {
        await acquireWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      wakeLockRef.current?.release();
    };
  }, []);

  useEffect(() => {
    socket.connect();
    socket.emit('join-board', { boardId });

    const onConnect = () => {
      setConnected(true);
      // Re-join siempre al (re)conectar — cubre reconexiones automáticas y vuelta de foco
      socket.emit('join-board', { boardId });
    };
    const onDisconnect = () => setConnected(false);

    // Reconexión al volver el foco en móvil (Page Visibility API)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (!socket.connected) {
          socket.connect();
        } else {
          // Ya conectado pero puede que el estado esté desincronizado — pedir board-state
          socket.emit('join-board', { boardId });
        }
      }
    };

    const onBoardState = ({ tiles: newTiles, name, locked }) => {
      setTiles(newTiles);
      if (name) setBoardName(name);
      setBoardLocked(locked || false);
    };

    const onTileUpdated = ({ tileId, state, config }) => {
      setTiles(prev => prev.map(t => {
        if (t.id !== tileId) return t;
        return {
          ...t,
          ...(state !== undefined && { state }),
          ...(config !== undefined && { config })
        };
      }));
    };

    const onTileConfigUpdated = ({ tileId, config }) => {
      setTiles(prev => prev.map(t => {
        if (t.id !== tileId) return t;
        return { ...t, config };
      }));
    };

    const onBoardUpdated = ({ tiles: newTiles, name }) => {
      setTiles(newTiles);
      if (name) setBoardName(name);
    };

    const onBoardLocked = () => setBoardLocked(true);
    const onBoardUnlocked = () => setBoardLocked(false);

    const onBoardDeleted = () => {
      alert('Este board ha sido eliminado.');
      navigate('/');
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('board-state', onBoardState);
    socket.on('tile-updated', onTileUpdated);
    socket.on('tile-config-updated', onTileConfigUpdated);
    socket.on('board-updated', onBoardUpdated);
    socket.on('board-locked', onBoardLocked);
    socket.on('board-unlocked', onBoardUnlocked);
    socket.on('board-deleted', onBoardDeleted);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('board-state', onBoardState);
      socket.off('tile-updated', onTileUpdated);
      socket.off('tile-config-updated', onTileConfigUpdated);
      socket.off('board-updated', onBoardUpdated);
      socket.off('board-locked', onBoardLocked);
      socket.off('board-unlocked', onBoardUnlocked);
      socket.off('board-deleted', onBoardDeleted);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      socket.disconnect();
    };
  }, [boardId, navigate]);

  const isOwnerOrAdmin = user && (user.is_admin || user.id === initialBoard.owner_id);

  const renderTile = useCallback((tile) => {
    const props = { key: tile.id, tile, socket, isOwnerOrAdmin, user, guestName, boardLocked };
    switch (tile.type) {
      case 'countdown': return <CountdownTile {...props} />;
      case 'stopwatch': return <StopwatchTile {...props} />;
      case 'clock': return <ClockTile {...props} />;
      case 'counter': return <CounterTile {...props} />;
      case 'messageboard': return <MessageBoardTile {...props} />;
      case 'chaosbag': return <ChaosBagTile {...props} />;
      case 'arkham_bag': return <ArkhamBagTile {...props} />;
      default: return null;
    }
  }, [isOwnerOrAdmin, user, guestName, boardLocked]);

  return (
    <div className="board-view">
      <div className="board-header">
        <h1>{boardName}</h1>
        <div className="board-header-actions">
          {isOwnerOrAdmin && (
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/board/${boardId}/edit`)}>
              ✏️ Editar
            </button>
          )}
          {isOwnerOrAdmin && (
            boardLocked
              ? <button className="btn btn-sm btn-warning" onClick={() => socket.emit('board-unlock', { boardId })}>🔓 Desbloquear</button>
              : <button className="btn btn-sm btn-danger" onClick={() => socket.emit('board-lock', { boardId })}>🔒 Bloquear</button>
          )}
          {wakeLockSupported && (
            <label className="wakelock-switch" title={wakeLockActive ? 'Pantalla siempre activa' : 'Pantalla puede bloquearse'}>
              <input type="checkbox" checked={wakeLockActive} onChange={toggleWakeLock} />
              <span className="wakelock-switch-track" />
              <span className="wakelock-switch-label">{wakeLockActive ? '🔆' : '🔅'}</span>
            </label>
          )}
          <div className="connection-status">
            <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`}></span>
            {connected ? 'Conectado' : 'Desconectado'}
          </div>
        </div>
      </div>
      {boardLocked && (
        <div className="board-locked-banner">
          <span>🔒 Tiles bloqueados — la cuenta atrás ha terminado</span>
        </div>
      )}
      <div className="tiles-grid">
        {tiles.map(tile => renderTile(tile))}
      </div>
      {tiles.length === 0 && (
        <div className="empty-state">
          <p>Este board no tiene tiles aún.</p>
        </div>
      )}
    </div>
  );
}
