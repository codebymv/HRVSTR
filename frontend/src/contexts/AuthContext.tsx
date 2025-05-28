import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { CredentialResponse } from '@react-oauth/google';

interface User {
  id: string;
  name: string;
  email: string;
  picture?: string;
  token: string; // Add token to user object for compatibility
}

interface AuthContextType {
  isAuthenticated: boolean;
  token: string | null;
  user: User | null;
  loading: boolean;
  login: (token: string) => void;
  logout: () => void;
  signIn: () => void;
  signOut: () => void;
  handleGoogleSuccess: (credentialResponse: CredentialResponse) => void;
  handleGoogleError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Token refresh interval (30 minutes - more frequent)
const REFRESH_INTERVAL = 30 * 60 * 1000;
// Token expiration buffer (5 minutes - larger buffer)
const EXPIRATION_BUFFER = 5 * 60 * 1000;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    // Initialize from localStorage
    const savedToken = localStorage.getItem('auth_token');
    const tokenExpiry = localStorage.getItem('token_expiry');
    
    if (savedToken && tokenExpiry) {
      const expiryTime = parseInt(tokenExpiry);
      if (Date.now() < expiryTime - EXPIRATION_BUFFER) {
        return savedToken;
      } else {
        // Token is expired or about to expire, clear it
        localStorage.removeItem('auth_token');
        localStorage.removeItem('token_expiry');
        localStorage.removeItem('user');
      }
    }
    return null;
  });

  const [user, setUser] = useState<User | null>(() => {
    // Initialize user from localStorage only if we have a valid token
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('auth_token');
    const tokenExpiry = localStorage.getItem('token_expiry');
    
    if (savedUser && savedToken && tokenExpiry) {
      const expiryTime = parseInt(tokenExpiry);
      if (Date.now() < expiryTime - EXPIRATION_BUFFER) {
        const userData = JSON.parse(savedUser);
        return { ...userData, token: savedToken };
      }
    }
    return null;
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!token);

  // Update user token when token changes
  useEffect(() => {
    if (user && token) {
      setUser(prev => prev ? { ...prev, token } : null);
    }
  }, [token]);

  // Setup axios interceptor for token refresh and error handling
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        // If error is 401/403 and we haven't tried to refresh yet
        if ((error.response?.status === 401 || error.response?.status === 403) && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            // Attempt to refresh the token
            const response = await axios.post('/api/auth/refresh', {
              token: token
            });
            
            const newToken = response.data.token;
            const expiresIn = response.data.expiresIn || 3600; // Default to 1 hour
            const expiryTime = Date.now() + (expiresIn * 1000);
            
            // Update token and expiry
            setToken(newToken);
            localStorage.setItem('auth_token', newToken);
            localStorage.setItem('token_expiry', expiryTime.toString());
            
            // Update user token
            if (user) {
              const updatedUser = { ...user, token: newToken };
              setUser(updatedUser);
            }
            
            // Retry the original request with new token
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            return axios(originalRequest);
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
            // If refresh fails, logout and redirect to login
            logout();
            return Promise.reject(refreshError);
          }
        }
        
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [token, user]);

  // Setup proactive token refresh timer
  useEffect(() => {
    if (!token) return;

    const refreshToken = async () => {
      try {
        const response = await axios.post('/api/auth/refresh', {
          token: token
        });
        
        const newToken = response.data.token;
        const expiresIn = response.data.expiresIn || 3600;
        const expiryTime = Date.now() + (expiresIn * 1000);
        
        setToken(newToken);
        localStorage.setItem('auth_token', newToken);
        localStorage.setItem('token_expiry', expiryTime.toString());
        
        // Update user token
        if (user) {
          const updatedUser = { ...user, token: newToken };
          setUser(updatedUser);
          localStorage.setItem('user', JSON.stringify({ ...user, token: newToken }));
        }
        
        console.log('Token refreshed successfully');
      } catch (error) {
        console.error('Proactive token refresh failed:', error);
        // Don't logout on proactive refresh failure, let the interceptor handle it
      }
    };

    // Check token expiry and refresh if needed
    const checkAndRefreshToken = () => {
      const expiryTime = parseInt(localStorage.getItem('token_expiry') || '0');
      const timeUntilExpiry = expiryTime - Date.now();
      
      // Refresh if token expires within the buffer time
      if (timeUntilExpiry <= EXPIRATION_BUFFER) {
        console.log('Token expiring soon, refreshing...');
        refreshToken();
      }
    };

    // Initial check
    checkAndRefreshToken();

    // Setup interval for regular checks
    const intervalId = setInterval(checkAndRefreshToken, REFRESH_INTERVAL);

    return () => clearInterval(intervalId);
  }, [token, user]);

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      console.error('No credential received from Google');
      return;
    }

    setLoading(true);
    
    try {
      // Parse the Google credential manually (it's a JWT)
      const base64Url = credentialResponse.credential.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      
      const decoded = JSON.parse(jsonPayload);
      
      // Send the Google user info to your backend
      const response = await axios.post('/api/auth/google-login', {
        googleId: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture
      });

      const { token: backendToken, user: userData } = response.data;
      
      // Store the backend token and user info
      login(backendToken);
      const userWithToken = { ...userData, token: backendToken };
      setUser(userWithToken);
      localStorage.setItem('user', JSON.stringify(userData));
      
    } catch (error) {
      console.error('Google login failed:', error);
      handleGoogleError();
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    console.error('Google login failed');
    setLoading(false);
  };

  const login = (newToken: string) => {
    // Set longer expiry time (24 hours)
    const expiryTime = Date.now() + (24 * 60 * 60 * 1000);
    setToken(newToken);
    setIsAuthenticated(true);
    localStorage.setItem('auth_token', newToken);
    localStorage.setItem('token_expiry', expiryTime.toString());
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('token_expiry');
    localStorage.removeItem('user');
    
    // Optional: Call backend logout endpoint
    try {
      axios.post('/api/auth/logout');
    } catch (error) {
      console.error('Backend logout failed:', error);
    }
  };

  // Launch Google OAuth directly
  const signIn = () => {
    // Use Google's OAuth popup flow
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error('Google Client ID not configured');
      return;
    }

    const redirectUri = window.location.origin;
    const scope = 'openid profile email';
    
    const authUrl = `https://accounts.google.com/oauth/authorize?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `response_type=code&` +
      `access_type=offline&` +
      `prompt=select_account`; // This forces account selection
    
    // Open in popup
    const popup = window.open(
      authUrl,
      'google-auth',
      'width=500,height=600,scrollbars=yes,resizable=yes'
    );
    
    // Listen for popup messages (you'd need to handle the OAuth callback)
    const checkClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkClosed);
        // Handle popup closed - could check for auth state change
      }
    }, 1000);
  };

  const signOut = logout;

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      token, 
      user, 
      loading, 
      login, 
      logout, 
      signIn, 
      signOut, 
      handleGoogleSuccess, 
      handleGoogleError 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
