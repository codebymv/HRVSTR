import { useTheme } from '../contexts/ThemeContext';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import Footer from './Footer';
import SentimentMonitor from './SentimentScraper/SentimentMonitor';
import HelpPage from './Help/HelpPage';
import StatusPage from './Status/StatusPage';
import { Routes, Route, Navigate } from 'react-router-dom';
import { 
  SECFilingsPage,
  EarningsMonitorPage,
} from '../pages';
import { ProtectedRoute } from './ProtectedRoute';
import Home from './Home/Home';
import UserHome from './Home/UserHome';
import SettingsLayout from './Settings/SettingsLayout';
import UsagePage from './Settings/tabs/UsagePage';
import ApiKeysPage from './Settings/tabs/ApiKeysPage';

import TiersPage from './Settings/tabs/TiersPage';
import ProfilePage from './Settings/tabs/ProfilePage';
import PreferencesPage from './Settings/tabs/PreferencesPage';
import BillingPage from './Settings/tabs/BillingPage';
import { useAuth } from '../contexts/AuthContext';

// Component for unauthorized access
const UnauthorizedPage = () => (
  <div className="p-6 text-center">
    <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
    <p>You don't have permission to access this page.</p>
  </div>
);

// Loading component for authentication state
const AuthLoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

const AppContent = () => {
  // Get the theme for conditional styling
  const { theme } = useTheme();
  const { isAuthenticated, loading } = useAuth();
  
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
            {/* Public routes - only accessible to unauthenticated users */}
            <Route path="/" element={
              loading ? <AuthLoadingSpinner /> : (
                isAuthenticated ? <Navigate to="/user-home" replace /> : <Home />
              )
            } />
            <Route path="/home" element={
              loading ? <AuthLoadingSpinner /> : (
                isAuthenticated ? <Navigate to="/user-home" replace /> : <Home />
              )
            } />
            
            {/* Help routes - accessible to all users */}
            <Route path="/help" element={<HelpPage />} />
            <Route path="/help/*" element={<HelpPage />} />
            
            {/* Status route - accessible to all users */}
            <Route path="/status" element={<StatusPage />} />
            
            {/* Protected routes - only accessible to authenticated users */}
            <Route path="/user-home" element={
              <ProtectedRoute>
                <UserHome />
              </ProtectedRoute>
            } />
            <Route path="/sentiment" element={
              <ProtectedRoute>
                <SentimentMonitor />
              </ProtectedRoute>
            } />
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
                <SettingsLayout />
              </ProtectedRoute>
            }>
              {/* Nested settings routes */}
              <Route index element={<Navigate to="/settings/usage" replace />} />
              <Route path="usage" element={<UsagePage />} />
              <Route path="api-keys" element={<ApiKeysPage />} />

              <Route path="profile" element={<ProfilePage />} />
              <Route path="notifications" element={<div className="p-8"><h1 className="text-2xl">Notifications - Coming Soon</h1></div>} />
              <Route path="preferences" element={<PreferencesPage />} />
              <Route path="tiers" element={<TiersPage />} />
              <Route path="billing" element={<BillingPage />} />
            </Route>
            
            {/* Additional routes */}
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            
            {/* Catch all route - redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <Footer />
    </div>
  );
};

export default AppContent;
