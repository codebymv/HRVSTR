import React, { createContext, useState, useContext, useEffect } from 'react';

type ThemeType = 'dark' | 'light';

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
}

// Get initial theme synchronously before component renders
const getInitialTheme = (): ThemeType => {
  // Check localStorage
  const savedTheme = localStorage.getItem('swTheme') as ThemeType;
  if (savedTheme) return savedTheme;
  
  // If no saved theme, check system preference
  if (typeof window !== 'undefined' && window.matchMedia) {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  }
  
  // Default to dark
  return 'dark';
};

// Initialize theme immediately
const initialTheme = getInitialTheme();
document.documentElement.classList.add(`${initialTheme}-theme`);
document.documentElement.setAttribute('data-theme', initialTheme);
document.documentElement.style.backgroundColor = initialTheme === 'dark' ? 'rgb(3, 7, 17)' : 'rgb(231, 229, 228)';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeType>(initialTheme);

  // Update localStorage and apply theme classes when theme changes
  useEffect(() => {
    localStorage.setItem('swTheme', theme);
    
    // Update document with theme class for CSS variables
    document.documentElement.classList.remove('light-theme', 'dark-theme');
    document.documentElement.classList.add(`${theme}-theme`);
    
    // Also update the data-theme attribute for components that might use it
    document.documentElement.setAttribute('data-theme', theme);
    
    // Update background color
    document.documentElement.style.backgroundColor = theme === 'dark' ? 'rgb(3, 7, 17)' : 'rgb(231, 229, 228)';
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
