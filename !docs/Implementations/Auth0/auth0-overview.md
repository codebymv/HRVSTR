# Auth0 Authentication Implementation Overview

This document provides a comprehensive overview of the Auth0 authentication implementation in the HRVSTR application.

## 1. Configuration

Authentication is powered by Auth0, a flexible and secure identity platform. The core configuration is defined in `frontend/src/config/auth0-config.ts`:

```typescript
export const auth0Config = {
  domain: import.meta.env.VITE_AUTH0_DOMAIN || 'dev-q8s86rgn7vmcvrco.us.auth0.com',
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID || 'yTdQaz5tHaEln0HMLgrFjZQVeRIzVrhk',
  redirectUri: window.location.origin,
};
```

This configuration uses environment variables with fallback values and dynamically sets the redirect URI to the application's origin.

## 2. Auth0 Provider Integration

The application uses the Auth0Provider component in `contexts/AuthContext.tsx` to wrap the application and provide authentication context:

```typescript
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
```

Key aspects of this implementation:
- Configures Auth0 using the previously defined config
- Sets up redirect handling after authentication
- Requests OpenID Connect scopes: `openid profile email`
- Provides authentication context to all child components

## 3. Custom Authentication Hook

The application implements a custom hook (`hooks/useAuth.ts`) that wraps Auth0's functionality and provides application-specific features:

```typescript
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

  // Role-based authorization
  const hasRole = useCallback((role: string) => {
    if (!user) return false;
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
```

This custom hook provides:
- Token acquisition with error handling
- Authentication status checks
- Login and logout functionality
- Role-based authorization using Auth0 custom claims
- Access to the user profile

## 4. Protected Routes

The application implements route protection using the `ProtectedRoute` component:

```typescript
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

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};
```

Key features:
- Displays a loading spinner during authentication checks
- Redirects unauthenticated users to the home page
- Supports role-based access control
- Redirects users without the required role to an unauthorized page

## 5. Auth0 Configuration Best Practices

### Current Implementation

- **Environment Variables**: Uses environment variables for sensitive configuration
- **Fallback Values**: Provides fallback values for development
- **Dynamic Redirect URI**: Sets redirect URI based on application origin
- **Role-Based Authorization**: Implements custom role checking

### Security Considerations

1. **Token Handling**: Uses getAccessTokenSilently for secure token acquisition
2. **Scopes**: Requests minimal necessary scopes (openid, profile, email)
3. **Role Verification**: Verifies user roles for protected routes

## 6. Auth0 Tenant Configuration

For the Auth0 tenant, ensure the following are properly configured:

1. **Application Settings**:
   - Allowed Callback URLs (must include your application URLs)
   - Allowed Logout URLs
   - Allowed Web Origins (for CORS)
   - Enable RBAC (Role-Based Access Control)

2. **User Management**:
   - Configure user roles and permissions
   - Set up appropriate role assignment workflows

3. **Rules/Actions**:
   - Configure rules to add roles to user tokens
   - Example namespace for roles: `https://hrvstr.com/roles`

## 7. Environment Configuration

The application expects the following environment variables:

```
VITE_AUTH0_DOMAIN=your-tenant.region.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id
```

These should be set in the appropriate environment files (.env.local, .env.production, etc.).
