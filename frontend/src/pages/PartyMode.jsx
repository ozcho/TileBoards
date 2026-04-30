import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import bazarLogo from '../el_bazar_de_iglesias_logo_final_rgb_grande-800x467.jpg';

const PARTY_NAME_KEY = 'partyName';

export default function PartyMode() {
  const { user } = useAuth();
  const loggedName = user?.name || null;

  const [name, setName] = useState(() => loggedName || sessionStorage.getItem(PARTY_NAME_KEY) || '');
  const [nameConfirmed, setNameConfirmed] = useState(() => !!(loggedName || sessionStorage.getItem(PARTY_NAME_KEY)));
  const [boards, setBoards] = useState([]);
  const [newBoardName, setNewBoardName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (loggedName) {
      sessionStorage.setItem('guestName', loggedName);
    }
  }, [loggedName]);

  useEffect(() => {
    if (!nameConfirmed) return;
    fetch('/api/party/boards')
      .then(r => r.json())
      .then(setBoards)
      .catch(() => {});
  }, [nameConfirmed]);

  const handleNameSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    sessionStorage.setItem(PARTY_NAME_KEY, trimmed);
    // Also set guestName so BoardView shows the name in tiles
    sessionStorage.setItem('guestName', trimmed);
    setNameConfirmed(true);
  };

  const handleJoin = async (boardId) => {
    // Grant session access via party endpoint
    await fetch(`/api/party/boards/${boardId}`, { credentials: 'include' });
    navigate(`/board/${boardId}`);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const trimmed = newBoardName.trim();
    if (!trimmed) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/party/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: trimmed })
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Error al crear el board');
        return;
      }
      const board = await res.json();
      navigate(`/board/${board.id}`);
    } catch {
      setError('Error de conexión');
    } finally {
      setCreating(false);
    }
  };

  if (!nameConfirmed) {
    return (
      <div className="party-welcome">
        <div className="party-welcome-card">
          <div className="party-logo">
            <img src={bazarLogo} alt="El Bazar de Iglesias" className="party-logo-img" />
          </div>
          <h1>Bazar Iglesias</h1>
          <p>¡Bienvenido! ¿Cómo te llamas?</p>
          <form onSubmit={handleNameSubmit}>
            <input
              type="text"
              className="input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Tu nombre"
              autoFocus
              required
              maxLength={50}
            />
            <button type="submit" className="btn btn-primary btn-lg">Entrar</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="party-page">
      <div className="party-header">
        <div className="party-logo">
          <img src={bazarLogo} alt="El Bazar de Iglesias" className="party-logo-img" />
        </div>
        <div>
          <h1>Bazar Iglesias</h1>
          <p className="party-greeting">Hola, <strong>{name}</strong>
            {!loggedName && (
              <> —
                <button className="btn-link" onClick={() => {
                  sessionStorage.removeItem(PARTY_NAME_KEY);
                  setNameConfirmed(false);
                  setName('');
                }}>cambiar nombre</button>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="party-create-section">
        <h2>Crear board</h2>
        <form className="party-create-form" onSubmit={handleCreate}>
          <input
            type="text"
            className="input"
            value={newBoardName}
            onChange={e => setNewBoardName(e.target.value)}
            placeholder="Nombre del board"
            maxLength={80}
            required
          />
          <button type="submit" className="btn btn-primary" disabled={creating}>
            {creating ? 'Creando…' : '+ Crear'}
          </button>
        </form>
        {error && <p className="party-error">{error}</p>}
      </div>

      <div className="party-boards-section">
        <h2>Boards activos</h2>
        {boards.length === 0 ? (
          <p className="party-empty">No hay boards activos. ¡Crea el primero!</p>
        ) : (
          <ul className="party-boards-list">
            {boards.map(b => (
              <li key={b.id} className="party-board-item">
                <span className="party-board-name">{b.name}</span>
                <button className="btn btn-secondary btn-sm" onClick={() => handleJoin(b.id)}>
                  Entrar →
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
