import { useAuth } from '../context/AuthContext';

export default function PendingApproval() {
  const { logout } = useAuth();

  return (
    <div className="pending-approval">
      <div className="pending-card">
        <div className="pending-icon">⏳</div>
        <h1>Cuenta pendiente de aprobación</h1>
        <p>
          Tu cuenta ha sido registrada correctamente, pero necesita ser aprobada
          por un administrador antes de poder acceder.
        </p>
        <p className="text-muted">
          Contacta con el administrador para que apruebe tu acceso.
        </p>
        <button onClick={logout} className="btn btn-secondary" style={{ marginTop: '1.5rem' }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
