import React, { createContext, useState, useContext, useEffect } from 'react';

type ThemeType = 'dark' | 'light';

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Get saved theme from localStorage or default to 'dark'
  const [theme, setTheme] = useState<ThemeType>(() => {
    const savedTheme = localStorage.getItem('swTheme');
    return (savedTheme as ThemeType) || 'dark';
  });

  // Update localStorage and apply theme classes when theme changes
  useEffect(() => {
    localStorage.setItem('swTheme', theme);
    
    // Update document with theme class for CSS variables
    document.documentElement.classList.remove('light-theme', 'dark-theme');
    document.documentElement.classList.add(`${theme}-theme`);
    
    // Also update the data-theme attribute for components that might use it
    document.documentElement.setAttribute('data-theme', theme);
    
    console.log('Theme changed to:', theme); // For debugging
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
