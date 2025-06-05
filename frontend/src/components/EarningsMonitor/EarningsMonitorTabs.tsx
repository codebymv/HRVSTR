import React from 'react';

interface EarningsMonitorTabsProps {
  activeTab: 'upcoming' | 'analysis';
  onTabChange: (tab: 'upcoming' | 'analysis') => void;
  tabActiveBg: string;
  tabActiveText: string;
  tabInactiveBg: string;
  tabInactiveText: string;
}

const EarningsMonitorTabs: React.FC<EarningsMonitorTabsProps> = ({
  activeTab,
  onTabChange,
  tabActiveBg,
  tabActiveText,
  tabInactiveBg,
  tabInactiveText,
}) => {
  return (
    <div className="mb-4 flex w-full">
      <button
        className={`py-2 px-4 rounded-t-lg font-medium text-sm flex-1 text-center ${
          activeTab === 'upcoming' ? `${tabActiveBg} ${tabActiveText}` : `${tabInactiveBg} ${tabInactiveText}`
        }`}
        onClick={() => onTabChange('upcoming')}
      >
        Upcoming Earnings
      </button>
      <button
        className={`py-2 px-4 rounded-t-lg font-medium text-sm flex-1 text-center ${
          activeTab === 'analysis' ? `${tabActiveBg} ${tabActiveText}` : `${tabInactiveBg} ${tabInactiveText}`
        }`}
        onClick={() => onTabChange('analysis')}
      >
        Earnings Analysis
      </button>
    </div>
  );
};

export default EarningsMonitorTabs; 