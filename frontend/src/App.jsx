import { Routes, Route } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import PendingApproval from './pages/PendingApproval';
import Dashboard from './pages/Dashboard';
import BoardAccess from './pages/BoardAccess';
import BoardEditor from './pages/BoardEditor';
import AdminPanel from './pages/AdminPanel';
import PartyMode from './pages/PartyMode';
import TokenIcon from './components/tiles/TokenIcon';

const ALL_TOKENS = ['+1', '0', '-1', '-2', '-3', '-4', '-5', '-6', '-7', '-8',
  'skull', 'cultist', 'tablet', 'elder_thing', 'tentacle', 'elder_star',
  'frost', 'bless', 'curse'];

function TokenPreloader() {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
      {ALL_TOKENS.map(t => <TokenIcon key={t} token={t} size={1} />)}
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  // User logged in but not approved
  if (user && !user.approved) {
    return (
      <div className="app">
        <Navbar />
        <main className="main-content">
          <PendingApproval />
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <TokenPreloader />
      <Navbar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={user ? <Dashboard /> : <Login />} />
          <Route path="/bazariglesias" element={<PartyMode />} />
          <Route path="/board/:id" element={<BoardAccess />} />
          <Route path="/board/:id/edit" element={user ? <BoardEditor /> : <Login />} />
          <Route path="/board/new" element={user ? <BoardEditor /> : <Login />} />
          <Route path="/admin" element={user?.is_admin ? <AdminPanel /> : <Login />} />
        </Routes>
      </main>
    </div>
  );
}
