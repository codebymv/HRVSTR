import { useTheme } from '../contexts/ThemeContext';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import SentimentDashboard from './SentimentScraper/SentimentDashboard';
import { Routes, Route } from 'react-router-dom';
import { 
  SECFilingsPage,
  SettingsPage,
  EarningsMonitorPage,
} from '../pages';
import { ProtectedRoute } from './ProtectedRoute';

// Component for unauthorized access
const UnauthorizedPage = () => (
  <div className="p-6 text-center">
    <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
    <p>You don't have permission to access this page.</p>
  </div>
);

const AppContent = () => {
  // Get the theme for conditional styling
  const { theme } = useTheme();
  
  // Apply theme-specific classes
  const bgColor = theme === 'dark' ? 'bg-gray-950' : 'bg-stone-200';
  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  
  return (
    <div className={`min-h-screen flex flex-col ${bgColor} ${textColor}`}>
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<SentimentDashboard />} />
            <Route path="/sentiment" element={<SentimentDashboard />} />
            
            {/* Protected routes */}
            <Route path="/sec-filings" element={
              <ProtectedRoute>
                <SECFilingsPage />
              </ProtectedRoute>
            } />
            <Route path="/earnings" element={
              <ProtectedRoute>
                <EarningsMonitorPage />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            } />
            
            {/* Additional routes */}
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default AppContent;
