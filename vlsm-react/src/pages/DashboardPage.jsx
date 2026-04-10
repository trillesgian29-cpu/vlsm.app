// pages/DashboardPage.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { CardHeader } from '../components/ui';

const PROTO_REF = [
  { name: 'Static',  ad: 1,   color: '#3b82f6', desc: 'Manual routes. Best for small, stable networks.' },
  { name: 'RIP v2',  ad: 120, color: '#34d399', desc: 'Distance vector. Max 15 hops. Classful networks.' },
  { name: 'EIGRP',   ad: 90,  color: '#f59e0b', desc: 'Hybrid. Fast convergence. AS must match.' },
  { name: 'OSPF',    ad: 110, color: '#a78bfa', desc: 'Link-state. Area 0. Cost-based metric.' },
];

export default function DashboardPage({ onNavigate }) {
  const { user }      = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.history()
      .then(d  => setHistory(d.history || []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="main">

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">
            Welcome back, <span style={{ color: 'var(--blue-h)', fontWeight: 600 }}>{user?.username}</span>
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => onNavigate('calculator')}>
          ▶ Open Calculator
        </button>
      </div>

      {/* Stats */}
      <div className="stats-row">
        {[
          { icon: '⚙', color: 'blue',   val: history.length, label: 'Calculations' },
          { icon: '🖥', color: 'green',  val: '∞',           label: 'CLI Ready' },
          { icon: '📡', color: 'orange', val: '4',            label: 'Protocols' },
          { icon: '🔒', color: 'purple', val: 'OFF',          label: 'Server Mode' },
        ].map(s => (
          <div className="stat-card" key={s.label}>
            <div className={`stat-icon icon-${s.color}`}>{s.icon}</div>
            <div>
              <div className="stat-val">{s.val}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* History */}
      <div className="card">
        <CardHeader
          icon="📋"
          iconVariant="blue"
          title="Recent Calculations"
          subtitle="Last 10 subnet calculations"
          right={
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('calculator')}>
              + New
            </button>
          }
        />
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>Loading…</div>
          ) : history.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: 32, opacity: 0.3, marginBottom: 10 }}>📊</div>
              <p>No calculations yet.</p>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => onNavigate('calculator')}>
                Calculate Now
              </button>
            </div>
          ) : (
            <table className="history-table">
              <thead>
                <tr>
                  <th>#</th><th>Title</th><th>Base Network</th><th>Mode</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map(row => (
                  <tr key={row.id}>
                    <td className="mono" style={{ color: 'var(--text3)' }}>{row.id}</td>
                    <td>{row.title}</td>
                    <td className="mono" style={{ color: 'var(--blue-h)' }}>{row.base_net}</td>
                    <td>
                      <span className={`badge badge-${row.mode === 'vlsm' ? 'vlsm' : 'flsm'}`}>
                        {row.mode.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text3)', fontSize: 11 }}>{row.created_at?.slice(0, 16)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Protocol Reference */}
      <div className="card">
        <CardHeader icon="📡" iconVariant="purple" title="Protocol Reference" subtitle="Administrative Distance · Cisco IOS" />
        <div className="card-body">
          <div className="proto-ref-grid">
            {PROTO_REF.map(p => (
              <div className="proto-ref-card" key={p.name}>
                <div className="proto-ref-name" style={{ color: p.color }}>{p.name}</div>
                <div className="proto-ref-ad">AD: {p.ad}</div>
                <div className="proto-ref-desc">{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
