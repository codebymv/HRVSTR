import { useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

export function useAuth() {
  const { 
    getAccessTokenSilently, 
    isAuthenticated, 
    isLoading, 
    loginWithRedirect, 
    logout, 
    user 
  } = useAuth0();

  const getAccessToken = useCallback(async () => {
    try {
      const token = await getAccessTokenSilently();
      return token;
    } catch (error) {
      console.error('Error getting access token:', error);
      throw error;
    }
  }, [getAccessTokenSilently]);

  // Add role checking if needed for your application
  const hasRole = useCallback((role: string) => {
    if (!user) return false;
    // Adjust the namespace based on your Auth0 configuration
    const roles = user['https://hrvstr.com/roles'] || [];
    return Array.isArray(roles) && roles.includes(role);
  }, [user]);

  return {
    getAccessToken,
    isAuthenticated,
    isLoading,
    loginWithRedirect,
    logout,
    user,
    hasRole
  };
}