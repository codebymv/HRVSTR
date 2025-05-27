import { ReactNode, createContext } from 'react';
import { Auth0Provider, AppState } from '@auth0/auth0-react';
import { auth0Config } from '../config/auth0-config';
import { useNavigate } from 'react-router-dom';

type AuthProviderProps = {
  children: ReactNode;
};

export const AuthContext = createContext({});

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const navigate = useNavigate();

  const onRedirectCallback = (appState?: AppState) => {
    navigate(appState?.returnTo || window.location.pathname);
  };

  return (
    <Auth0Provider
      domain={auth0Config.domain}
      clientId={auth0Config.clientId}
      authorizationParams={{
        redirect_uri: auth0Config.redirectUri,
        scope: 'openid profile email'
      }}
      onRedirectCallback={onRedirectCallback}
    >
      {children}
    </Auth0Provider>
  );
};
