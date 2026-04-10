// components/Topbar.jsx
import { useAuth } from '../hooks/useAuth';

const NAV = [
  { key: 'dashboard',  label: 'Dashboard' },
  { key: 'calculator', label: 'Calculator' },
  { key: 'cheatsheet', label: 'Cheat Sheet' },
];

export default function Topbar({ page, onNavigate }) {
  const { user, logout } = useAuth();

  return (
    <header className="topbar">
      <button className="topbar-logo" onClick={() => onNavigate('dashboard')}>
        <div className="topbar-logo-icon">⬡</div>
        <span className="topbar-title">NetCalc Pro</span>
      </button>

      <div className="topbar-sep" />
      <span className="topbar-sub">VLSM · FLSM · Cisco CLI</span>

      <nav className="topbar-nav">
        {NAV.map(n => (
          <button
            key={n.key}
            className={`topbar-link ${page === n.key ? 'active' : ''}`}
            onClick={() => onNavigate(n.key)}
          >
            {n.label}
          </button>
        ))}
      </nav>

      <div className="topbar-right">
        <div className="status-badge">
          <div className="status-dot" />
          OFFLINE
        </div>
        <div className="user-chip">{user?.username}</div>
        <button className="btn btn-ghost btn-sm" onClick={logout}>
          Logout
        </button>
      </div>
    </header>
  );
}
