import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import UserHome from './components/Home/UserHome';
import { Dashboard } from './components/Dashboard/Dashboard';
import SentimentDashboard from './components/SentimentScraper/SentimentDashboard';

// Component for unauthorized access
const UnauthorizedPage = () => (
  <div className="p-6 text-center">
    <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
    <p>You don't have permission to access this page.</p>
  </div>
);

// Component for not found pages
const NotFoundPage = () => (
  <div className="p-6 text-center">
    <h2 className="text-2xl font-bold mb-4">404 - Page Not Found</h2>
    <p>The page you're looking for doesn't exist.</p>
  </div>
);

export const AppContent = () => {
  return (
    <Routes>
      {/* Public route */}
      <Route path="/" element={<UserHome />} />

      {/* Protected routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sentiment"
        element={
          <ProtectedRoute>
            <SentimentDashboard />
          </ProtectedRoute>
        }
      />

      {/* Error pages */}
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}; 