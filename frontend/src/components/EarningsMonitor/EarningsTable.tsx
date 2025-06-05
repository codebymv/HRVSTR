import React from 'react';
import { EarningsEvent } from '../../types';
import { AlertTriangle, Info } from 'lucide-react';

interface EarningsTableProps {
  sortedEarnings: EarningsEvent[];
  selectedTicker: string | null;
  analyzedTickers: Set<string>;
  onTickerClick: (ticker: string) => void;
  errors: { upcomingEarnings: string | null };
  // Theme props
  textColor: string;
  subTextColor: string;
  headerBg: string;
  cardBorder: string;
  isLight: boolean;
}

const EarningsTable: React.FC<EarningsTableProps> = ({
  sortedEarnings,
  selectedTicker,
  analyzedTickers,
  onTickerClick,
  errors,
  textColor,
  subTextColor,
  headerBg,
  cardBorder,
  isLight,
}) => {
  if (errors.upcomingEarnings) {
    return (
      <div className={`flex flex-col items-center justify-center p-10 ${subTextColor} text-center`}>
        <AlertTriangle className="mb-2 text-yellow-500" size={32} />
        <p>{errors.upcomingEarnings}</p>
      </div>
    );
  }

  if (sortedEarnings.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center p-10 ${subTextColor} text-center`}>
        <Info className="mb-2" size={32} />
        <p>No upcoming earnings found in the selected time range</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className={`min-w-full ${textColor}`}>
        <thead className={`${headerBg} border-b ${cardBorder}`}>
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Ticker</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Company</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Date</th>
          </tr>
        </thead>
        <tbody className={`divide-y ${cardBorder}`}>
          {sortedEarnings
            .filter((earnings) => {
              if (!earnings.ticker || typeof earnings.ticker !== 'string' || earnings.ticker.trim() === '') {
                return false;
              }
              return true;
            })
            .map((earnings, index) => {
              if (!earnings.ticker || typeof earnings.ticker !== 'string' || earnings.ticker.trim() === '') {
                return null;
              }
              
              // Determine row styling - blue highlight for selected OR previously analyzed
              const isSelected = selectedTicker === earnings.ticker;
              const isAnalyzed = analyzedTickers.has(earnings.ticker);
              const shouldHighlight = isSelected || isAnalyzed;
              
              const rowBg = shouldHighlight ? (isLight ? 'bg-blue-100' : 'bg-blue-900/30') : '';
              const hoverBg = isLight ? 'hover:bg-stone-200' : 'hover:bg-gray-800';
              
              return (
                <tr 
                  key={`earnings-${earnings.ticker}-${index}`} 
                  className={`${hoverBg} ${rowBg} cursor-pointer transition-colors`}
                  onClick={() => onTickerClick(earnings.ticker)}
                >
                  <td className="px-4 py-3 font-medium">{earnings.ticker}</td>
                  <td className="px-4 py-3">
                    {earnings.companyName || 'Unknown Company'}
                  </td>
                  <td className="px-4 py-3">
                    {earnings.reportDate ? 
                      new Date(earnings.reportDate).toLocaleDateString() : 
                      'TBA'}
                  </td>
                </tr>
              );
            })
            .filter(Boolean)}
        </tbody>
      </table>
    </div>
  );
};

export default EarningsTable; 