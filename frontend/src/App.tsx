// React is used implicitly for JSX
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { TierProvider } from './contexts/TierContext';
import { ToastProvider } from './contexts/ToastContext';
import AppContent from './components/AppContent';
import { ToastContainer } from './components/UI/Toast';
import { Elements } from '@stripe/react-stripe-js';
import stripePromise from './lib/stripe';

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <AuthProvider>
          <TierProvider>
            <ToastProvider>
              <Elements stripe={stripePromise}>
                <AppContent />
                <ToastContainer />
              </Elements>
            </ToastProvider>
          </TierProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;