import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface SentimentTickerContextType {
  selectedTickers: string[];
  setSelectedTickers: (tickers: string[]) => void;
  updateSelectedTickers: (updater: (prev: string[]) => string[]) => void;
}

const SentimentTickerContext = createContext<SentimentTickerContextType | undefined>(undefined);

interface SentimentTickerProviderProps {
  children: ReactNode;
  initialTickers?: string[];
}

export const SentimentTickerProvider: React.FC<SentimentTickerProviderProps> = ({ 
  children, 
  initialTickers = [] 
}) => {
  const [selectedTickers, setSelectedTickers] = useState<string[]>(initialTickers);
  
  const updateSelectedTickers = useCallback((updater: (prev: string[]) => string[]) => {
    setSelectedTickers(updater);
  }, []);

  const value = {
    selectedTickers,
    setSelectedTickers,
    updateSelectedTickers
  };

  return (
    <SentimentTickerContext.Provider value={value}>
      {children}
    </SentimentTickerContext.Provider>
  );
};

export const useSentimentTickers = () => {
  const context = useContext(SentimentTickerContext);
  if (context === undefined) {
    throw new Error('useSentimentTickers must be used within a SentimentTickerProvider');
  }
  return context;
};

// Optional version that returns null if not within provider
export const useSentimentTickersOptional = () => {
  const context = useContext(SentimentTickerContext);
  return context || null;
}; 