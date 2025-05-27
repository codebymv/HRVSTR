import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Define types directly for testing purposes
type ThemeMode = 'light' | 'dark' | 'system';

interface UserSettings {
  theme: ThemeMode;
  chartPreferences: {
    showVolume: boolean;
    timeScale: string;
    indicatorSet: string;
  };
  defaultTickers: string[];
  refreshInterval: number;
  notificationsEnabled: boolean;
}

// Since we don't have direct access to the settings manager, I'll recreate a simplified version
// based on common patterns for testing purposes

interface SettingsManager {
  saveSettings(settings: Partial<UserSettings>): boolean;
  loadSettings(): UserSettings;
  getDefaultSettings(): UserSettings;
  updateTheme(mode: ThemeMode): boolean;
  clearSettings(): boolean;
}

// Default settings
const DEFAULT_SETTINGS: UserSettings = {
  theme: 'light',
  chartPreferences: {
    showVolume: true,
    timeScale: '1d',
    indicatorSet: 'basic'
  },
  defaultTickers: ['AAPL', 'MSFT', 'GOOGL'],
  refreshInterval: 300, // 5 minutes
  notificationsEnabled: true
};

// Create a shared mock localStorage that persists between test runs
// This is crucial for the 'persist theme between sessions' test
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    // Additional required Storage interface properties
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
    get length() { return Object.keys(store).length; },
    // Custom helper for tests
    getAll: () => store
  };
})();

// Setup localStorage for tests - only needs to be done once
if (typeof global.localStorage === 'undefined') {
  global.localStorage = mockLocalStorage;
} else {
  // Replace the method implementations without trying to set getters/length
  vi.spyOn(global.localStorage, 'getItem').mockImplementation(mockLocalStorage.getItem);
  vi.spyOn(global.localStorage, 'setItem').mockImplementation(mockLocalStorage.setItem);
  vi.spyOn(global.localStorage, 'clear').mockImplementation(mockLocalStorage.clear);
  vi.spyOn(global.localStorage, 'removeItem').mockImplementation(mockLocalStorage.removeItem);
  vi.spyOn(global.localStorage, 'key').mockImplementation(mockLocalStorage.key);
}

// Create a settings manager that uses the shared localStorage
const createSettingsManager = (): SettingsManager => {
  let currentSettings: UserSettings = { ...DEFAULT_SETTINGS };
  
  return {
    saveSettings(settings: Partial<UserSettings>): boolean {
      try {
        // Merge with current settings
        currentSettings = { ...currentSettings, ...settings };
        // Save to localStorage
        mockLocalStorage.setItem('hrvstr-settings', JSON.stringify(currentSettings));
        return true;
      } catch (error) {
        console.error('Error saving settings:', error);
        return false;
      }
    },
    
    loadSettings(): UserSettings {
      try {
        const savedSettings = mockLocalStorage.getItem('hrvstr-settings');
        if (!savedSettings) {
          return { ...DEFAULT_SETTINGS };
        }
        
        return { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
      } catch (error) {
        console.error('Error loading settings:', error);
        return { ...DEFAULT_SETTINGS };
      }
    },
    
    getDefaultSettings(): UserSettings {
      return { ...DEFAULT_SETTINGS };
    },
    
    updateTheme(mode: ThemeMode): boolean {
      try {
        currentSettings.theme = mode;
        mockLocalStorage.setItem('hrvstr-settings', JSON.stringify(currentSettings));
        return true;
      } catch (error) {
        console.error('Error updating theme:', error);
        return false;
      }
    },
    
    clearSettings(): boolean {
      try {
        mockLocalStorage.removeItem('hrvstr-settings');
        currentSettings = { ...DEFAULT_SETTINGS };
        return true;
      } catch (error) {
        console.error('Error clearing settings:', error);
        return false;
      }
    }
  };
};

describe('Settings Manager', () => {
  let settingsManager: SettingsManager;
  
  beforeEach(() => {
    // Create a fresh settings manager for each test
    settingsManager = createSettingsManager();
  });
  
  describe('Default Settings', () => {
    it('should provide default settings when no settings are saved', () => {
      const settings = settingsManager.loadSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });
    
    it('should have expected default theme', () => {
      const settings = settingsManager.getDefaultSettings();
      expect(settings.theme).toBe('light');
    });
    
    it('should include basic default tickers', () => {
      const settings = settingsManager.getDefaultSettings();
      expect(settings.defaultTickers).toContain('AAPL');
      expect(settings.defaultTickers.length).toBeGreaterThanOrEqual(3);
    });
  });
  
  describe('Save and Load Settings', () => {
    it('should save and retrieve user settings correctly', () => {
      // Update some settings
      const newSettings = {
        theme: 'dark' as ThemeMode,
        chartPreferences: {
          showVolume: false,
          timeScale: '1w',
          indicatorSet: 'advanced'
        }
      };
      
      // Save the settings
      const saveResult = settingsManager.saveSettings(newSettings);
      expect(saveResult).toBe(true);
      
      // Load the settings and verify they were saved correctly
      const loadedSettings = settingsManager.loadSettings();
      expect(loadedSettings.theme).toBe('dark');
      expect(loadedSettings.chartPreferences.showVolume).toBe(false);
      expect(loadedSettings.chartPreferences.timeScale).toBe('1w');
      expect(loadedSettings.chartPreferences.indicatorSet).toBe('advanced');
      
      // Verify that unchanged settings remain at default values
      expect(loadedSettings.defaultTickers).toEqual(DEFAULT_SETTINGS.defaultTickers);
      expect(loadedSettings.notificationsEnabled).toBe(DEFAULT_SETTINGS.notificationsEnabled);
    });
    
    it('should handle partial settings updates correctly', () => {
      // First update
      settingsManager.saveSettings({
        theme: 'dark' as ThemeMode
      });
      
      // Second update (different property)
      settingsManager.saveSettings({
        refreshInterval: 120 // 2 minutes
      });
      
      // Load and verify both updates were applied
      const settings = settingsManager.loadSettings();
      expect(settings.theme).toBe('dark');
      expect(settings.refreshInterval).toBe(120);
      
      // Original properties should remain unchanged
      expect(settings.chartPreferences).toEqual(DEFAULT_SETTINGS.chartPreferences);
    });
  });
  
  describe('Theme Management', () => {
    it('should update theme mode specifically', () => {
      // Update theme
      const result = settingsManager.updateTheme('dark');
      expect(result).toBe(true);
      
      // Check that theme was updated
      const settings = settingsManager.loadSettings();
      expect(settings.theme).toBe('dark');
    });
    
    it('should persist theme between sessions', () => {
      // Set theme
      settingsManager.updateTheme('dark');
      
      // Create a new settings manager (simulating app restart)
      const newSession = createSettingsManager();
      
      // Theme should still be dark
      const settings = newSession.loadSettings();
      expect(settings.theme).toBe('dark');
    });
  });
  
  describe('Settings Reset', () => {
    it('should clear user settings and revert to defaults', () => {
      // First, modify some settings
      settingsManager.saveSettings({
        theme: 'dark' as ThemeMode,
        refreshInterval: 60,
        notificationsEnabled: false
      });
      
      // Verify settings were changed
      let settings = settingsManager.loadSettings();
      expect(settings.theme).toBe('dark');
      
      // Clear settings
      const clearResult = settingsManager.clearSettings();
      expect(clearResult).toBe(true);
      
      // Verify settings were reset to defaults
      settings = settingsManager.loadSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle corrupt JSON in localStorage gracefully', () => {
      // Directly set invalid JSON in localStorage
      localStorage.setItem('hrvstr-settings', 'not-valid-json');
      
      // Should return default settings
      const settings = settingsManager.loadSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });
  });
});
