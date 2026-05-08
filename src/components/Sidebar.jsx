import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { logoutUser, getCurrentUser } from '../services/supabaseAuthService';
import './Sidebar.css';

export default function Sidebar() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  // Get current user on mount
  useState(() => {
    async function loadUser() {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (err) {
        console.error('[Sidebar] Failed to load user:', err);
      }
    }
    loadUser();
  }, []);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logoutUser();
      navigate('/login');
    } catch (err) {
      console.error('[Sidebar] Logout failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-icon">⚡</span>
        <span className="logo-text">ChillerAI</span>
      </div>

      <div className="sidebar-nav">
        <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">📊</span>
          <span className="nav-label">Dashboard</span>
        </NavLink>

        <NavLink to="/chat" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">💬</span>
          <span className="nav-label">AI Assistant</span>
        </NavLink>

        <NavLink to="/energy-forecast" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">🔮</span>
          <span className="nav-label">Energy Forecast</span>
        </NavLink>
        <NavLink to="/maintenance-scheduler" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">🛠️</span>
          <span className="nav-label">Maintenance</span>
        </NavLink>
        <NavLink to="/cost-savings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">💰</span>
          <span className="nav-label">Cost Savings</span>
        </NavLink>
      </div>

      <div className="sidebar-footer">
        {user && (
          <div className="sidebar-user">
            <div className="user-avatar">👤</div>
            <div className="user-info">
              <p className="user-email">{user.email}</p>
            </div>
          </div>
        )}
        <button
          className="logout-button"
          onClick={handleLogout}
          disabled={loading}
          title="Sign out"
        >
          <span className="nav-icon">🚪</span>
          <span className="nav-label">{loading ? 'Signing out...' : 'Sign Out'}</span>
        </button>
      </div>
    </nav>
  );
}