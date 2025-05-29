// React is used implicitly for JSX
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { TierProvider } from './contexts/TierContext';
import AppContent from './components/AppContent';
import { Elements } from '@stripe/react-stripe-js';
import stripePromise from './lib/stripe';

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <AuthProvider>
          <TierProvider>
            <Elements stripe={stripePromise}>
              <AppContent />
            </Elements>
          </TierProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;