import { NavLink } from 'react-router-dom';
import './Sidebar.css';

export default function Sidebar() {
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
      </div>
      
      <div className="sidebar-footer">
        <div className="nav-item disabled">
          <span className="nav-icon">⚙️</span>
          <span className="nav-label">Settings</span>
        </div>
      </div>
    </nav>
  );
}