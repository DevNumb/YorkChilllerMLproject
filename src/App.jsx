import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import ChatPage from './pages/ChatPage';
import EnergyForecasting from './pages/EnergyForecasting';
import MaintenanceScheduler from './pages/MaintenanceScheduler';
import CostSavingsDashboard from './pages/CostSavingsDashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import { getCurrentSession, onAuthStateChange } from './services/supabaseAuthService';

function ProtectedRoute({ children, isAuthenticated, isLoading }) {
  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    async function checkAuth() {
      try {
        const session = await getCurrentSession();
        setIsAuthenticated(!!session);
      } catch (err) {
        console.error('[App] Failed to check auth:', err);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkAuth();

    // Subscribe to auth state changes
    const subscription = onAuthStateChange((event, session) => {
      console.log('[App] Auth state changed:', event);
      setIsAuthenticated(!!session);
    });

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected Routes */}
      <Route
        path="/*"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
            <div className="app-container">
              <Sidebar />
              <main className="main-content">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/chat" element={<ChatPage />} />
                  <Route path="/energy-forecast" element={<EnergyForecasting />} />
                  <Route path="/maintenance-scheduler" element={<MaintenanceScheduler />} />
                  <Route path="/cost-savings" element={<CostSavingsDashboard />} />
                </Routes>
              </main>
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}