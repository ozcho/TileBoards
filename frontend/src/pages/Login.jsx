import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Login() {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/boards/public')
      .then(res => res.json())
      .then(data => { setBoards(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>🎯 Countineitor</h1>
        <p>Boards interactivos en tiempo real</p>
      </div>

      <div className="public-boards">
        <h2>Boards Disponibles</h2>
        {loading ? (
          <div className="loading">Cargando...</div>
        ) : boards.length === 0 ? (
          <div className="empty-state"><p>No hay boards disponibles aún.</p></div>
        ) : (
          <div className="boards-grid">
            {boards.map(board => (
              <Link key={board.id} to={`/board/${board.id}`} className="board-card board-card-link">
                <h3>{board.name}</h3>
                <p className="board-meta">
                  <span className="board-owner">Por: {board.owner_name}</span>
                </p>
                <span className="badge">🔒 Requiere contraseña</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
