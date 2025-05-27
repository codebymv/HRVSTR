// Auth0 configuration for HRVSTR application
export const auth0Config = {
  domain: import.meta.env.VITE_AUTH0_DOMAIN || 'dev-q8s86rgn7vmcvrco.us.auth0.com',
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID || 'yTdQaz5tHaEln0HMLgrFjZQVeRIzVrhk',
  redirectUri: window.location.origin,
};
