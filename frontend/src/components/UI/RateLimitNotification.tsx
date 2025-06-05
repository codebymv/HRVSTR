import React from 'react';
import { AlertCircle } from 'lucide-react';

interface RateLimitNotificationProps {
  isActive: boolean;
  message?: string;
  className?: string;
}

const RateLimitNotification: React.FC<RateLimitNotificationProps> = ({ 
  isActive, 
  message = "API rate limit reached. Data will refresh automatically in a moment...",
  className = "mb-4"
}) => {
  if (!isActive) return null;

  return (
    <div className={`${className} p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-lg flex items-center`}>
      <AlertCircle className="w-5 h-5 mr-2" />
      <span>{message}</span>
    </div>
  );
};

export default RateLimitNotification; 