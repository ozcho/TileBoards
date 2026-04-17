import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BoardView from './BoardView';

export default function BoardAccess() {
  const { id } = useParams();
  const { user } = useAuth();
  const [board, setBoard] = useState(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [needsName, setNeedsName] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/boards/${id}/public`, { credentials: 'include' })
      .then(res => {
        if (res.ok) return res.json();
        if (res.status === 401) {
          setNeedsPassword(true);
          setLoading(false);
          return null;
        }
        throw new Error('Board no encontrado');
      })
      .then(data => {
        if (data) {
          if (!user) {
            const savedName = sessionStorage.getItem('guestName');
            if (savedName) {
              setGuestName(savedName);
              setBoard(data);
            } else {
              setBoard(data);
              setNeedsName(true);
            }
          } else {
            setBoard(data);
          }
          setLoading(false);
        }
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch(`/api/boards/${id}/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password })
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Error de acceso');
        return;
      }

      const data = await res.json();
      if (!user) {
        const savedName = sessionStorage.getItem('guestName');
        if (savedName) {
          setGuestName(savedName);
          setBoard(data);
          setNeedsPassword(false);
        } else {
          setBoard(data);
          setNeedsPassword(false);
          setNeedsName(true);
        }
      } else {
        setBoard(data);
        setNeedsPassword(false);
      }
    } catch {
      setError('Error de conexión');
    }
  };

  if (loading) return <div className="loading">Cargando...</div>;
  if (error && !needsPassword) return <div className="error-page"><h2>Error</h2><p>{error}</p></div>;

  if (needsName && !user) {
    const handleNameSubmit = (e) => {
      e.preventDefault();
      const name = guestName.trim();
      if (!name) return;
      sessionStorage.setItem('guestName', name);
      setNeedsName(false);
    };

    return (
      <div className="password-page">
        <div className="password-card">
          <h2>👋 ¿Cómo te llamas?</h2>
          <p>Tu nombre aparecerá en los mensajes que envíes</p>
          <form onSubmit={handleNameSubmit}>
            <input
              type="text"
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              placeholder="Tu nombre"
              className="input"
              required
              autoFocus
              maxLength={50}
            />
            <button type="submit" className="btn btn-primary">Entrar</button>
          </form>
        </div>
      </div>
    );
  }

  if (needsPassword) {
    return (
      <div className="password-page">
        <div className="password-card">
          <h2>🔒 Board Protegido</h2>
          <p>Introduce la contraseña para acceder</p>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={handlePasswordSubmit}>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="input"
              required
              autoFocus
            />
            <button type="submit" className="btn btn-primary">Acceder</button>
          </form>
        </div>
      </div>
    );
  }

  if (board && !needsName) {
    return <BoardView board={board} user={user} guestName={guestName} />;
  }

  return null;
}
