import { createContext, useContext, ReactNode, useState, useCallback } from 'react';
import { GoogleOAuthProvider, CredentialResponse, useGoogleLogin } from '@react-oauth/google';

interface User {
  id: string;
  name: string;
  email: string;
  picture: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: () => void;
  signOut: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { 'Authorization': `Bearer ${tokenResponse.access_token}` },
      });
      const userInfo = await userInfoResponse.json();
      setUser({
        id: userInfo.sub,
        name: userInfo.name,
        email: userInfo.email,
        picture: userInfo.picture,
      });
      setLoading(false);
    },
    onError: () => {
      console.error('Google Sign In was unsuccessful');
      setLoading(false);
    },
    flow: 'implicit',
    scope: 'profile email openid',
  });

  const signIn = useCallback(() => {
    setLoading(true);
    googleLogin();
  }, [googleLogin]);

  const signOut = useCallback(() => {
    setUser(null);
  }, []);

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
      <AuthContext.Provider value={{ 
        user, 
        loading, 
        isAuthenticated: !!user,
        signIn, 
        signOut 
      }}>
        {children}
      </AuthContext.Provider>
    </GoogleOAuthProvider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
