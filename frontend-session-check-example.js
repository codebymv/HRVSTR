/**
 * Frontend Session Checking for Unlockable Components
 * This shows how to check session status when users visit pages
 */

// Hook for managing component unlock sessions
export const useComponentUnlock = (componentName) => {
  const [unlockStatus, setUnlockStatus] = useState({
    isUnlocked: false,
    isLoading: true,
    sessionId: null,
    expiresAt: null,
    timeRemaining: 0,
    needsReauth: false
  });

  // Check session status on component mount and periodically
  useEffect(() => {
    checkUnlockSession();
    
    // Set up periodic checking every 60 seconds
    const interval = setInterval(checkUnlockSession, 60000);
    
    return () => clearInterval(interval);
  }, [componentName]);

  const checkUnlockSession = async () => {
    try {
      setUnlockStatus(prev => ({ ...prev, isLoading: true }));
      
      // 1. First check localStorage for cached session
      const localSession = checkLocalSession(componentName);
      
      if (localSession && !localSession.isExpired) {
        // 2. Verify with server that session is still valid
        const serverResponse = await fetch('/api/credits/active-sessions', {
          headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        
        if (serverResponse.ok) {
          const data = await serverResponse.json();
          const activeSession = data.activeSessions?.find(s => s.component === componentName);
          
          if (activeSession && activeSession.timeRemainingHours > 0) {
            // Session is valid on server
            updateLocalSession(componentName, activeSession);
            setUnlockStatus({
              isUnlocked: true,
              isLoading: false,
              sessionId: activeSession.session_id,
              expiresAt: activeSession.expires_at,
              timeRemaining: activeSession.timeRemainingHours,
              needsReauth: false
            });
            return;
          }
        }
      }
      
      // 3. No valid session found - component is locked
      removeLocalSession(componentName);
      setUnlockStatus({
        isUnlocked: false,
        isLoading: false,
        sessionId: null,
        expiresAt: null,
        timeRemaining: 0,
        needsReauth: false
      });
      
    } catch (error) {
      console.error('Error checking unlock session:', error);
      setUnlockStatus(prev => ({ 
        ...prev, 
        isLoading: false,
        needsReauth: error.status === 401 
      }));
    }
  };

  const unlockComponent = async (cost) => {
    try {
      setUnlockStatus(prev => ({ ...prev, isLoading: true }));
      
      const response = await fetch('/api/credits/unlock-component', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          component: componentName,
          cost: cost
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Store session in localStorage
        storeLocalSession(componentName, {
          sessionId: data.sessionId,
          expiresAt: data.expiresAt,
          creditsUsed: data.creditsUsed,
          tier: getUserTier() // Get from auth context
        });
        
        setUnlockStatus({
          isUnlocked: true,
          isLoading: false,
          sessionId: data.sessionId,
          expiresAt: data.expiresAt,
          timeRemaining: data.sessionDurationHours,
          needsReauth: false
        });
        
        // Show success message
        showToast(`${componentName} unlocked for ${data.sessionDurationHours} hours!`);
        
      } else {
        throw new Error(data.error || 'Failed to unlock component');
      }
      
    } catch (error) {
      console.error('Error unlocking component:', error);
      setUnlockStatus(prev => ({ ...prev, isLoading: false }));
      showToast(`Failed to unlock ${componentName}: ${error.message}`, 'error');
    }
  };

  return {
    ...unlockStatus,
    unlockComponent,
    refreshSession: checkUnlockSession
  };
};

// Local session management functions (from your existing sessionStorage.ts)
const checkLocalSession = (component) => {
  try {
    const stored = localStorage.getItem(`hrvstr_unlock_${component}`);
    if (!stored) return null;

    const data = JSON.parse(stored);
    
    // Check if session has expired
    if (Date.now() > data.expiresAt) {
      localStorage.removeItem(`hrvstr_unlock_${component}`);
      return { isExpired: true };
    }

    return {
      ...data,
      isExpired: false,
      timeRemaining: Math.round((data.expiresAt - Date.now()) / (1000 * 60 * 60) * 10) / 10
    };
  } catch (error) {
    localStorage.removeItem(`hrvstr_unlock_${component}`);
    return null;
  }
};

const storeLocalSession = (component, sessionData) => {
  try {
    const unlockData = {
      unlocked: true,
      timestamp: Date.now(),
      expiresAt: new Date(sessionData.expiresAt).getTime(),
      sessionId: sessionData.sessionId,
      component,
      creditsUsed: sessionData.creditsUsed,
      tier: sessionData.tier
    };

    localStorage.setItem(`hrvstr_unlock_${component}`, JSON.stringify(unlockData));
    
    console.log(`📦 Stored unlock session for ${component}`, {
      sessionId: sessionData.sessionId,
      expiresAt: new Date(unlockData.expiresAt).toLocaleString()
    });
  } catch (error) {
    console.error('Error storing unlock session:', error);
  }
};

const updateLocalSession = (component, serverSession) => {
  const existing = checkLocalSession(component);
  if (existing && !existing.isExpired) {
    existing.expiresAt = new Date(serverSession.expires_at).getTime();
    existing.timeRemaining = serverSession.timeRemainingHours;
    localStorage.setItem(`hrvstr_unlock_${component}`, JSON.stringify(existing));
  }
};

const removeLocalSession = (component) => {
  localStorage.removeItem(`hrvstr_unlock_${component}`);
};

// Component implementation example
export const ProtectedComponent = ({ 
  componentName, 
  cost, 
  children, 
  fallback 
}) => {
  const { 
    isUnlocked, 
    isLoading, 
    timeRemaining, 
    unlockComponent,
    needsReauth 
  } = useComponentUnlock(componentName);

  if (needsReauth) {
    return <RedirectToLogin />;
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isUnlocked) {
    return fallback || (
      <UnlockPrompt 
        componentName={componentName}
        cost={cost}
        onUnlock={() => unlockComponent(cost)}
      />
    );
  }

  return (
    <div className="unlocked-component">
      <div className="session-timer">
        ⏰ {timeRemaining.toFixed(1)} hours remaining
      </div>
      {children}
    </div>
  );
};

// Usage in your components
export const ChartPage = () => {
  return (
    <div>
      <h1>Stock Chart Analysis</h1>
      
      <ProtectedComponent 
        componentName="chart" 
        cost={8}
        fallback={<ChartUnlockPrompt />}
      >
        <StockChart />
        <TechnicalIndicators />
        <PriceAlerts />
      </ProtectedComponent>
    </div>
  );
};

// Utility functions
const getAuthToken = () => {
  // Get from your auth context/storage
  return localStorage.getItem('authToken');
};

const getUserTier = () => {
  // Get from your auth context
  return 'pro'; // or whatever the user's tier is
};

const showToast = (message, type = 'success') => {
  // Your toast notification system
  console.log(`${type.toUpperCase()}: ${message}`);
}; 