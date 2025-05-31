import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { useGoogleLogin, googleLogout, CredentialResponse } from '@react-oauth/google';
import axios from 'axios';

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
  login: (token: string, refreshToken?: string) => void;
  logout: () => void;
  signIn: () => void;
  signOut: () => void;
  handleGoogleSuccess: (credentialResponse: CredentialResponse) => void;
  handleGoogleError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Token refresh interval (24 hours - much less frequent since tokens last 7 days)
const REFRESH_INTERVAL = 24 * 60 * 60 * 1000;
// Token expiration buffer (1 day - check refresh 1 day before expiry)
const EXPIRATION_BUFFER = 24 * 60 * 60 * 1000;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Add refs to prevent infinite loops
  const isLoggingOut = useRef(false);
  const backendLogoutFailures = useRef(0);
  const refreshTokenRef = useRef<string | null>(null);
  const tokenRefreshInProgress = useRef(false);

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

        const { token: backendToken, refreshToken, user: userData } = response.data;
        
        console.log('Backend response:', response.data);
        console.log('User data received:', userData);
        
        // Store the backend token and user info
        login(backendToken, refreshToken);
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
        const savedRefreshToken = localStorage.getItem('refresh_token');
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
                refreshTokenRef.current = savedRefreshToken;
                setUser({ ...userData, token: savedToken });
                setIsAuthenticated(true);
              } catch (parseError) {
                console.error('Error parsing saved user data:', parseError);
                // Clear corrupted data
                clearAuthData();
              }
            }
          } else {
            console.log('Token expired or expiring soon, will attempt refresh...');
            // Don't clear immediately - let the refresh logic handle it
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        // Clear all auth data on any error
        clearAuthData();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []); // Remove dependencies to prevent loops

  // Helper function to clear auth data
  const clearAuthData = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('token_expiry');
    localStorage.removeItem('user');
    refreshTokenRef.current = null;
  };

  // Setup axios interceptor for token refresh and error handling (only once)
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        // Prevent infinite retry loops
        if (originalRequest._retryCount >= 3) {
          console.log('Max retry attempts reached, logging out...');
          if (!isLoggingOut.current) {
            logout();
          }
          return Promise.reject(error);
        }
        
        // If error is 401/403 and we haven't tried to refresh yet
        if ((error.response?.status === 401 || error.response?.status === 403) && !originalRequest._retry) {
          originalRequest._retry = true;
          originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
          
          const currentRefreshToken = refreshTokenRef.current;
          if (!currentRefreshToken || tokenRefreshInProgress.current) {
            console.log('No refresh token available or refresh in progress, logging out...');
            if (!isLoggingOut.current) {
            logout();
            }
            return Promise.reject(error);
          }

          try {
            console.log('Attempting to refresh token...');
            tokenRefreshInProgress.current = true;
            
            // Attempt to refresh the token
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            const response = await axios.post(`${apiUrl}/api/auth/refresh`, {
              token: token // Send current token for refresh
            });
            
            const { token: newToken, refreshToken: newRefreshToken, expiresIn } = response.data;
            const expiryTime = Date.now() + (expiresIn * 1000);
            
            console.log('Token refreshed successfully');
            
            // Update token and expiry
            setToken(newToken);
            localStorage.setItem('auth_token', newToken);
            localStorage.setItem('token_expiry', expiryTime.toString());
            
            if (newRefreshToken) {
              refreshTokenRef.current = newRefreshToken;
              localStorage.setItem('refresh_token', newRefreshToken);
            }
            
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
            if (!isLoggingOut.current) {
            logout();
            }
            return Promise.reject(refreshError);
          } finally {
            tokenRefreshInProgress.current = false;
          }
        }
        
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []); // Remove dependencies to prevent re-registration

  // Token refresh function
  const refreshTokenFn = async () => {
    const savedToken = localStorage.getItem('auth_token');
    const refreshTokenValue = refreshTokenRef.current;
    
    if (!savedToken || !refreshTokenValue || tokenRefreshInProgress.current) {
      console.log('No tokens available for refresh or refresh in progress');
      return false;
    }

    try {
      console.log('Refreshing token...');
      tokenRefreshInProgress.current = true;
      
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await axios.post(`${apiUrl}/api/auth/refresh`, {
        token: savedToken
      });

      const { token: newToken, refreshToken: newRefreshToken, expiresIn } = response.data;
      const expiryTime = Date.now() + (expiresIn * 1000);

      // Update tokens
      setToken(newToken);
      localStorage.setItem('auth_token', newToken);
      localStorage.setItem('token_expiry', expiryTime.toString());
      
      if (newRefreshToken) {
        refreshTokenRef.current = newRefreshToken;
        localStorage.setItem('refresh_token', newRefreshToken);
      }

      console.log('Token refreshed successfully');
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      if (!isLoggingOut.current) {
      logout();
      }
      return false;
    } finally {
      tokenRefreshInProgress.current = false;
    }
  };

  // Check and refresh token if needed
  const checkAndRefreshToken = () => {
    const tokenExpiry = localStorage.getItem('token_expiry');
    
    if (!tokenExpiry || tokenRefreshInProgress.current) return;
    
    const expiryTime = parseInt(tokenExpiry);
    const now = Date.now();
    
    // If token expires within the buffer time, refresh it
    if (now >= expiryTime - EXPIRATION_BUFFER) {
      refreshTokenFn();
    }
  };

  // Set up periodic token refresh check (only once)
  useEffect(() => {
    if (!token) return;

    // Initial check
    checkAndRefreshToken();

    // Setup interval for regular checks (daily)
    const intervalId = setInterval(checkAndRefreshToken, REFRESH_INTERVAL);

    return () => clearInterval(intervalId);
  }, []); // Remove dependencies to prevent multiple intervals

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

      const { token: backendToken, refreshToken, user: userData } = response.data;
      
      console.log('Backend response (credential):', response.data);
      console.log('User data received (credential):', userData);
      
      // Store the backend token and user info
      login(backendToken, refreshToken);
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

  const login = (newToken: string, refreshToken?: string) => {
    // Set longer expiry time (7 days to match backend)
    const expiryTime = Date.now() + (7 * 24 * 60 * 60 * 1000);
    setToken(newToken);
    setIsAuthenticated(true);
    
    if (refreshToken) {
      refreshTokenRef.current = refreshToken;
    }
    
    try {
      localStorage.setItem('auth_token', newToken);
      localStorage.setItem('token_expiry', expiryTime.toString());
      
      if (refreshToken) {
        localStorage.setItem('refresh_token', refreshToken);
      }
      
      // Check for post-signin redirect intent
      const redirectPath = localStorage.getItem('post_signin_redirect');
      if (redirectPath) {
        localStorage.removeItem('post_signin_redirect');
        // Use a small delay to ensure auth state updates complete
        setTimeout(() => {
          window.location.href = redirectPath;
        }, 100);
      }
    } catch (storageError) {
      console.error('Error saving auth data to localStorage:', storageError);
    }
  };

  const logout = () => {
    // Prevent multiple simultaneous logout calls
    if (isLoggingOut.current) {
      console.log('Logout already in progress, skipping...');
      return;
    }
    
    isLoggingOut.current = true;
    console.log('Logging out user...');
    
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    refreshTokenRef.current = null;
    tokenRefreshInProgress.current = false;
    
    try {
      clearAuthData();
    } catch (storageError) {
      console.error('Error clearing localStorage:', storageError);
    }
    
    // Sign out from Google
    try {
      googleLogout();
    } catch (googleError) {
      console.error('Error signing out from Google:', googleError);
    }
    
    // Only call backend logout if we haven't failed too many times
    if (backendLogoutFailures.current < 5) {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        axios.post(`${apiUrl}/api/auth/logout`).catch((error) => {
          console.error('Backend logout failed:', error);
          backendLogoutFailures.current++;
          if (backendLogoutFailures.current >= 5) {
            console.log('Too many backend logout failures, disabling backend logout calls');
          }
        });
    } catch (error) {
      console.error('Backend logout failed:', error);
        backendLogoutFailures.current++;
      }
    }
    
    // Reset logout flag after a delay
    setTimeout(() => {
      isLoggingOut.current = false;
    }, 1000);
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
