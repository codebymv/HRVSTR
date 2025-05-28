import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { CredentialResponse, googleLogout, useGoogleLogin } from '@react-oauth/google';

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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Use Google Login hook for direct OAuth
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      try {
        // Get user info from Google using the access token
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            Authorization: `Bearer ${tokenResponse.access_token}`,
          },
        });
        
        const googleUser = await userInfoResponse.json();
        
        // Send the Google user info to your backend
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const response = await axios.post(`${apiUrl}/api/auth/google-login`, {
          googleId: googleUser.id,
          email: googleUser.email,
          name: googleUser.name,
          picture: googleUser.picture
        });

        const { token: backendToken, user: userData } = response.data;
        
        console.log('Backend response:', response.data);
        console.log('User data received:', userData);
        
        // Store the backend token and user info
        login(backendToken);
        const userWithToken = { ...userData, token: backendToken };
        console.log('User with token:', userWithToken);
        setUser(userWithToken);
        try {
          localStorage.setItem('user', JSON.stringify(userData));
        } catch (storageError) {
          console.error('Error saving user data to localStorage:', storageError);
        }
        
      } catch (error) {
        console.error('Google login failed:', error);
        handleGoogleError();
      } finally {
        setLoading(false);
      }
    },
    onError: () => {
      console.error('Google login failed');
      setLoading(false);
    },
  });

  // Initialize authentication state from localStorage
  useEffect(() => {
    const initializeAuth = () => {
      try {
        const savedToken = localStorage.getItem('auth_token');
        const tokenExpiry = localStorage.getItem('token_expiry');
        const savedUser = localStorage.getItem('user');
        
        if (savedToken && tokenExpiry && savedUser) {
          const expiryTime = parseInt(tokenExpiry);
          if (Date.now() < expiryTime - EXPIRATION_BUFFER) {
            // Add null check before parsing JSON
            if (savedUser && savedUser !== 'undefined' && savedUser !== 'null') {
              try {
                const userData = JSON.parse(savedUser);
                setToken(savedToken);
                setUser({ ...userData, token: savedToken });
                setIsAuthenticated(true);
              } catch (parseError) {
                console.error('Error parsing saved user data:', parseError);
                // Clear corrupted data
                localStorage.removeItem('auth_token');
                localStorage.removeItem('token_expiry');
                localStorage.removeItem('user');
              }
            }
          } else {
            // Token is expired, clear everything
            localStorage.removeItem('auth_token');
            localStorage.removeItem('token_expiry');
            localStorage.removeItem('user');
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        // Clear all auth data on any error
        localStorage.removeItem('auth_token');
        localStorage.removeItem('token_expiry');
        localStorage.removeItem('user');
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

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
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            const response = await axios.post(`${apiUrl}/api/auth/refresh`, {
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
              try {
                localStorage.setItem('user', JSON.stringify({ ...user, token: newToken }));
              } catch (storageError) {
                console.error('Error saving user to localStorage:', storageError);
              }
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
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const response = await axios.post(`${apiUrl}/api/auth/refresh`, {
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
          try {
            localStorage.setItem('user', JSON.stringify({ ...user, token: newToken }));
          } catch (storageError) {
            console.error('Error saving user to localStorage:', storageError);
          }
        }
        
        console.log('Token refreshed successfully');
      } catch (error) {
        console.error('Proactive token refresh failed:', error);
        // Don't logout on proactive refresh failure, let the interceptor handle it
      }
    };

    // Check token expiry and refresh if needed
    const checkAndRefreshToken = () => {
      const expiryTimeString = localStorage.getItem('token_expiry');
      if (!expiryTimeString || expiryTimeString === 'null' || expiryTimeString === 'undefined') {
        return;
      }
      
      const expiryTime = parseInt(expiryTimeString);
      if (isNaN(expiryTime)) {
        console.error('Invalid token expiry time:', expiryTimeString);
        return;
      }
      
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
    // Keep this for backward compatibility if needed
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
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await axios.post(`${apiUrl}/api/auth/google-login`, {
        googleId: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture
      });

      const { token: backendToken, user: userData } = response.data;
      
      console.log('Backend response (credential):', response.data);
      console.log('User data received (credential):', userData);
      
      // Store the backend token and user info
      login(backendToken);
      const userWithToken = { ...userData, token: backendToken };
      console.log('User with token (credential):', userWithToken);
      setUser(userWithToken);
      try {
        localStorage.setItem('user', JSON.stringify(userData));
      } catch (storageError) {
        console.error('Error saving user data to localStorage:', storageError);
      }
      
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
    try {
      localStorage.setItem('auth_token', newToken);
      localStorage.setItem('token_expiry', expiryTime.toString());
    } catch (storageError) {
      console.error('Error saving auth data to localStorage:', storageError);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    
    try {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('token_expiry');
      localStorage.removeItem('user');
    } catch (storageError) {
      console.error('Error clearing localStorage:', storageError);
    }
    
    // Sign out from Google
    try {
      googleLogout();
    } catch (googleError) {
      console.error('Error signing out from Google:', googleError);
    }
    
    // Optional: Call backend logout endpoint
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      axios.post(`${apiUrl}/api/auth/logout`);
    } catch (error) {
      console.error('Backend logout failed:', error);
    }
  };

  // Direct sign in - triggers Google OAuth popup immediately
  const signIn = () => {
    googleLogin();
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
