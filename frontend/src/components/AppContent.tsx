import { useTheme } from '../contexts/ThemeContext';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import SentimentDashboard from './SentimentScraper/SentimentDashboard';
import { Routes, Route, Navigate } from 'react-router-dom';
import { 
  SECFilingsPage,
  SettingsPage,
  EarningsMonitorPage,
} from '../pages';
import { ProtectedRoute } from './ProtectedRoute';
import Home from './Home/Home';
import UserHome from './Home/UserHome';
import { useAuth } from '../contexts/AuthContext';

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
  const { isAuthenticated } = useAuth();
  
  // Apply theme-specific classes
  const bgColor = theme === 'dark' ? 'bg-gray-950' : 'bg-stone-200';
  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  
  return (
    <div className={`min-h-screen flex flex-col ${bgColor} ${textColor}`}>
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        {isAuthenticated && <Sidebar />}
        <main className={`flex-1 overflow-y-auto ${!isAuthenticated ? 'w-full' : ''}`}>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={isAuthenticated ? <UserHome /> : <Home />} />
            <Route path="/home" element={isAuthenticated ? <UserHome /> : <Home />} />
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
            
            {/* Catch all route - redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default AppContent;
