import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  const { user, loading, isAuthenticated, signIn, signOut } = context;

  // Removed Auth0 specific functions like getAccessToken and hasRole
  // If you need role-based access with Google OAuth, it needs to be implemented
  // within the AuthContext and User interface.

  return {
    user,
    loading,
    isAuthenticated,
    signIn,
    signOut,
    // hasRole is removed as it was Auth0 specific
  };
}