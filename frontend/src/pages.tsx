import React from 'react';
import SECFilingsDashboard from './components/SECFilings/SECFilingsDashboard';
import Settings from './components/Settings/Settings';
import EarningsMonitor from './components/EarningsMonitor/EarningsMonitor';

// Common loading handler factory to keep code DRY
const createLoadingHandler = (componentName: string) => {
  return (progress: number, stage: string) => {
    console.log(`${componentName} loading: ${progress}% - ${stage}`);
    // If needed in the future, we could add global loading state updates here
  };
};

export const SECFilingsPage: React.FC = () => {
  const handleLoadingProgressChange = createLoadingHandler('SEC Filings');
  
  return (
    <SECFilingsDashboard onLoadingProgressChange={handleLoadingProgressChange} />
  );
};

export const SettingsPage: React.FC = () => {
  const handleLoadingProgressChange = createLoadingHandler('Settings');
  
  return (
    <Settings onLoadingProgressChange={handleLoadingProgressChange} />
  );
};

export const EarningsMonitorPage: React.FC = () => {
  const handleLoadingProgressChange = createLoadingHandler('Earnings Monitor');
  
  return (
    <EarningsMonitor onLoadingProgressChange={handleLoadingProgressChange} />
  );
};
