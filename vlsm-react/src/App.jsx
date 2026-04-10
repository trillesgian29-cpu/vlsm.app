// src/App.jsx
import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import AuthPage       from './pages/AuthPage';
import DashboardPage  from './pages/DashboardPage';
import CalculatorPage from './pages/CalculatorPage';
import CheatSheetPage from './pages/CheatSheetPage';
import Topbar         from './components/Topbar';

export default function App() {
  const { user, loading } = useAuth();
  const [page, setPage]   = useState('dashboard');

  if (loading) {
    return (
      <div className="splash">
        <div className="splash-icon">⬡</div>
        <div className="spinner" />
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return (
    <div className="app">
      <Topbar page={page} onNavigate={setPage} />
      <div className="page-content">
        {page === 'dashboard'  && <DashboardPage  onNavigate={setPage} />}
        {page === 'calculator' && <CalculatorPage />}
        {page === 'cheatsheet' && <CheatSheetPage />}
      </div>
    </div>
  );
}
