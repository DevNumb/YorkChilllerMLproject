import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import ChatPage from './pages/ChatPage';
import EnergyForecasting from './pages/EnergyForecasting';
import MaintenanceScheduler from './pages/MaintenanceScheduler';
import CostSavingsDashboard from './pages/CostSavingsDashboard';

export default function App() {
  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/energy-forecast" element={<EnergyForecasting />} />
          <Route path="/maintenance-scheduler" element={<MaintenanceScheduler />} />
          <Route path="/cost-savings" element={<CostSavingsDashboard />} />
        </Routes>
      </main>
    </div>
  );
}