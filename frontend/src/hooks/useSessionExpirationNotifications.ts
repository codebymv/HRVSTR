import { useEffect, useRef } from 'react';
import { useToast } from '../contexts/ToastContext';

interface SessionExpiration {
  component: string;
  description: string;
  expiredAt: string;
}

interface UseSessionExpirationNotificationsConfig {
  enabled?: boolean;
  pollingInterval?: number; // in milliseconds
}

export const useSessionExpirationNotifications = (config: UseSessionExpirationNotificationsConfig = {}) => {
  const { warning } = useToast();
  const lastCheckedRef = useRef<Date>(new Date());
  const shownExpirationsRef = useRef<Set<string>>(new Set());
  
  const {
    enabled = true,
    pollingInterval = 30000 // Check every 30 seconds
  } = config;
  
  const checkForRecentExpirations = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      
      const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';
      
      const response = await fetch(`${proxyUrl}/api/credits/recent-expirations`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        console.warn('Failed to check for recent expirations:', response.status);
        return;
      }
      
      const data = await response.json();
      
      if (data.success && data.expirations.length > 0) {
        // Filter out expirations we've already shown
        const newExpirations = data.expirations.filter((exp: SessionExpiration) => {
          const expKey = `${exp.component}_${exp.expiredAt}`;
          return !shownExpirationsRef.current.has(expKey);
        });
        
        // Show toast notifications for new expirations
        newExpirations.forEach((expiration: SessionExpiration) => {
          const expKey = `${expiration.component}_${expiration.expiredAt}`;
          
          // Mark as shown to prevent duplicates
          shownExpirationsRef.current.add(expKey);
          
          // Show the toast notification
          warning(`${expiration.component} session expired`, 5000);
          
          console.log(`🔒 Session expiration notification: ${expiration.component} - ${expiration.description}`);
        });
        
        // Clean up old entries from the shown set (keep only last 100)
        if (shownExpirationsRef.current.size > 100) {
          const entries = Array.from(shownExpirationsRef.current);
          shownExpirationsRef.current = new Set(entries.slice(-50));
        }
      }
      
      lastCheckedRef.current = new Date();
    } catch (error) {
      console.warn('Error checking for session expirations:', error);
    }
  };
  
  useEffect(() => {
    if (!enabled) return;
    
    // Initial check after a short delay
    const initialTimer = setTimeout(checkForRecentExpirations, 5000);
    
    // Set up regular polling
    const interval = setInterval(checkForRecentExpirations, pollingInterval);
    
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [enabled, pollingInterval]);
  
  return {
    checkForRecentExpirations,
    lastChecked: lastCheckedRef.current
  };
}; 