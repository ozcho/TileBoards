import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const [myBoards, setMyBoards] = useState([]);
  const [otherBoards, setOtherBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      fetch('/api/boards', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/boards/public').then(r => r.json())
    ]).then(([mine, all]) => {
      setMyBoards(mine);
      const myIds = new Set(mine.map(b => b.id));
      setOtherBoards(all.filter(b => !myIds.has(b.id)));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este board?')) return;
    await fetch(`/api/boards/${id}`, { method: 'DELETE', credentials: 'include' });
    setMyBoards(myBoards.filter(b => b.id !== id));
  };

  const copyLink = (id) => {
    navigator.clipboard.writeText(`${window.location.origin}/board/${id}`);
    alert('¡Link copiado al portapapeles!');
  };

  if (loading) return <div className="loading">Cargando...</div>;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Mis Boards</h1>
        <Link to="/board/new" className="btn btn-primary">+ Nuevo Board</Link>
      </div>

      {myBoards.length === 0 ? (
        <div className="empty-state">
          <p>No tienes boards aún. ¡Crea uno!</p>
        </div>
      ) : (
        <div className="boards-grid">
          {myBoards.map(board => (
            <div key={board.id} className="board-card">
              <h3>{board.name}</h3>
              <p className="board-meta">
                {user.is_admin && board.owner_id !== user.id && (
                  <span className="badge">De: {board.owner_name}</span>
                )}
                <span className="board-id">ID: {board.id.slice(0, 8)}...</span>
              </p>
              <div className="board-actions">
                <button onClick={() => navigate(`/board/${board.id}`)} className="btn btn-sm">Ver</button>
                <button onClick={() => navigate(`/board/${board.id}/edit`)} className="btn btn-sm btn-secondary">Editar</button>
                <button onClick={() => handleDelete(board.id)} className="btn btn-sm btn-danger">Eliminar</button>
                <button onClick={() => copyLink(board.id)} className="btn btn-sm">📋 Copiar Link</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {otherBoards.length > 0 && (
        <>
          <h2 style={{ marginTop: '2rem' }}>Otros Boards</h2>
          <div className="boards-grid">
            {otherBoards.map(board => (
              <Link key={board.id} to={`/board/${board.id}`} className="board-card board-card-link">
                <h3>{board.name}</h3>
                <p className="board-meta">
                  <span className="board-owner">Por: {board.owner_name}</span>
                </p>
                <span className="badge">🔒 Requiere contraseña</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
