import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark' | 'system';
type ColorScheme = string; // Allow hex colors like '#007AFF' or named schemes

interface ThemeContextType {
  theme: 'light' | 'dark';
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  mode: 'system',
  setMode: () => {},
  colorScheme: 'magenta',
  setColorScheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useSystemColorScheme();
  const [mode, setMode] = useState<ThemeMode>('system');
  const [colorScheme, setColorScheme] = useState<ColorScheme>('magenta');
  const [theme, setTheme] = useState<'light' | 'dark'>(systemColorScheme === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    loadTheme();
    loadColorScheme();
  }, []);

  useEffect(() => {
    if (mode === 'system') {
      setTheme(systemColorScheme === 'dark' ? 'dark' : 'light');
    } else {
      setTheme(mode);
    }
  }, [mode, systemColorScheme]);

  const loadTheme = async () => {
    try {
      const savedMode = await AsyncStorage.getItem('themeMode');
      if (savedMode && (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system')) {
        setMode(savedMode as ThemeMode);
      }
    } catch (error) {
      console.error('Failed to load theme:', error);
    }
  };

  const loadColorScheme = async () => {
    try {
      const savedScheme = await AsyncStorage.getItem('colorScheme');
      if (savedScheme) {
        setColorScheme(savedScheme as ColorScheme);
      }
    } catch (error) {
      console.error('Failed to load color scheme:', error);
    }
  };

  const handleSetMode = async (newMode: ThemeMode) => {
    setMode(newMode);
    try {
      await AsyncStorage.setItem('themeMode', newMode);
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  };

  const handleSetColorScheme = async (newScheme: ColorScheme) => {
    setColorScheme(newScheme);
    try {
      await AsyncStorage.setItem('colorScheme', newScheme);
    } catch (error) {
      console.error('Failed to save color scheme:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode: handleSetMode, colorScheme, setColorScheme: handleSetColorScheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  // Return default values if context is not available to avoid hook order violations
  if (!context) {
    return {
      theme: 'dark',
      mode: 'system' as const,
      setMode: () => {},
      colorScheme: 'magenta',
      setColorScheme: () => {},
    };
  }
  return context;
};