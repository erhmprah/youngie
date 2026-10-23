import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface IncognitoContextType {
  isIncognito: boolean;
  toggleIncognito: () => void;
  setIncognito: (value: boolean) => void;
}

const IncognitoContext = createContext<IncognitoContextType | undefined>(undefined);

const STORAGE_KEY = 'isIncognito';

export function IncognitoProvider({ children }: { children: React.ReactNode }) {
  const [isIncognito, setIsIncognito] = useState(false);

  useEffect(() => {
    const restoreIncognito = async () => {
      try {
        const value = await AsyncStorage.getItem(STORAGE_KEY);
        if (value === 'true') {
          setIsIncognito(true);
        }
      } catch (error) {
        console.warn('Failed to restore incognito state:', error);
      }
    };
    restoreIncognito();
  }, []);

  const setIncognito = useCallback(async (value: boolean) => {
    setIsIncognito(value);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
    } catch (error) {
      console.warn('Failed to persist incognito state:', error);
    }
  }, []);

  const toggleIncognito = useCallback(() => {
    setIncognito(!isIncognito);
  }, [isIncognito, setIncognito]);

  return (
    <IncognitoContext.Provider value={{ isIncognito, toggleIncognito, setIncognito }}>
      {children}
    </IncognitoContext.Provider>
  );
}

export function useIncognito() {
  const context = useContext(IncognitoContext);
  if (!context) {
    throw new Error('useIncognito must be used within an IncognitoProvider');
  }
  return context;
}
