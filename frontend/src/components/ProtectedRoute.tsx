import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

type ProtectedRouteProps = {
  children: ReactNode;
  requiredRole?: string;
};

export const ProtectedRoute = ({ 
  children, 
  requiredRole 
}: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, hasRole } = useAuth();

  if (isLoading) {
    return <div className="flex justify-center items-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
    </div>;
  }

  // For development purposes, bypass authentication check
  // This will allow access to protected routes without authentication
  // Remove this in production
  const bypassAuth = true; // Set to true for development, false for production

  if (!isAuthenticated && !bypassAuth) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole && !hasRole(requiredRole) && !bypassAuth) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};