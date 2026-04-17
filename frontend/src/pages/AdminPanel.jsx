import { useState, useEffect } from 'react';

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/users', { credentials: 'include' })
      .then(res => res.json())
      .then(data => { setUsers(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const toggleAdmin = async (userId, currentStatus) => {
    await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ is_admin: !currentStatus })
    });
    setUsers(users.map(u =>
      u.id === userId ? { ...u, is_admin: !currentStatus ? 1 : 0 } : u
    ));
  };

  const toggleApproval = async (userId, currentStatus) => {
    await fetch(`/api/users/${userId}/approve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ approved: !currentStatus })
    });
    setUsers(users.map(u =>
      u.id === userId ? { ...u, approved: !currentStatus ? 1 : 0 } : u
    ));
  };

  const deleteUser = async (userId) => {
    if (!confirm('¿Eliminar este usuario? Se eliminarán todos sus boards.')) return;
    await fetch(`/api/users/${userId}`, { method: 'DELETE', credentials: 'include' });
    setUsers(users.filter(u => u.id !== userId));
  };

  if (loading) return <div className="loading">Cargando...</div>;

  const pendingUsers = users.filter(u => !u.approved);
  const approvedUsers = users.filter(u => u.approved);

  return (
    <div className="admin-panel">
      <h1>Gestión de Usuarios</h1>

      {pendingUsers.length > 0 && (
        <>
          <h2 className="admin-section-title">
            <span className="badge badge-pending">Pendientes de aprobación ({pendingUsers.length})</span>
          </h2>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Avatar</th>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Registrado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map(user => (
                  <tr key={user.id}>
                    <td>
                      {user.avatar
                        ? <img src={user.avatar} alt="" className="user-avatar-sm" referrerPolicy="no-referrer" />
                        : '—'}
                    </td>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>{new Date(user.created_at).toLocaleDateString('es')}</td>
                    <td className="actions-cell">
                      <button
                        onClick={() => toggleApproval(user.id, false)}
                        className="btn btn-xs btn-success"
                      >
                        ✓ Aprobar
                      </button>
                      <button
                        onClick={() => deleteUser(user.id)}
                        className="btn btn-xs btn-danger"
                      >
                        ✕ Rechazar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2 className="admin-section-title">Usuarios aprobados</h2>
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Avatar</th>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Registrado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {approvedUsers.map(user => (
              <tr key={user.id}>
                <td>
                  {user.avatar
                    ? <img src={user.avatar} alt="" className="user-avatar-sm" referrerPolicy="no-referrer" />
                    : '—'}
                </td>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>
                  <span className={`badge ${user.is_admin ? 'badge-admin' : 'badge-user'}`}>
                    {user.is_admin ? 'Admin' : 'Usuario'}
                  </span>
                </td>
                <td>{new Date(user.created_at).toLocaleDateString('es')}</td>
                <td className="actions-cell">
                  <button
                    onClick={() => toggleAdmin(user.id, user.is_admin)}
                    className="btn btn-xs btn-secondary"
                  >
                    {user.is_admin ? 'Quitar Admin' : 'Hacer Admin'}
                  </button>
                  <button
                    onClick={() => toggleApproval(user.id, true)}
                    className="btn btn-xs btn-warning"
                  >
                    Revocar acceso
                  </button>
                  <button
                    onClick={() => deleteUser(user.id)}
                    className="btn btn-xs btn-danger"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
