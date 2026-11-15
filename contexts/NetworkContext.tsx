import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import * as Network from 'expo-network';
import { setAppOfflineState } from '@/utils/api';

interface NetworkContextType {
  isOnline: boolean;
  isOffline: boolean;
  networkType: string | null;
  isInternetReachable: boolean | null;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [networkType, setNetworkType] = useState<string | null>(null);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(null);
  const isChecking = useRef(false);

  const checkNetworkState = useCallback(async () => {
    if (isChecking.current) return;
    isChecking.current = true;
    try {
      const state = await Network.getNetworkStateAsync();
      const connected = state.isConnected ?? false;
      const reachable = state.isInternetReachable;
      // Treat null/unknown reachability as online when connected to avoid false "no connection" on launch.
      const online = connected && reachable !== false;
      setIsOnline(online);
      setNetworkType(state.type ?? null);
      setIsInternetReachable(reachable ?? null);
      setAppOfflineState(!online);
    } catch (error) {
      console.warn('Network state check failed:', error);
      setIsOnline(false);
      setAppOfflineState(true);
    } finally {
      isChecking.current = false;
    }
  }, []);

  useEffect(() => {
    checkNetworkState();

    let subscription: { remove: () => void } | null = null;
    try {
      if (Network.addNetworkStateListener) {
        subscription = Network.addNetworkStateListener((state) => {
          const connected = state.isConnected ?? false;
          const reachable = state.isInternetReachable;
          // Treat null/unknown reachability as online when connected to avoid false "no connection" on launch.
          const online = connected && reachable !== false;
          setIsOnline(online);
          setNetworkType(state.type ?? null);
          setIsInternetReachable(reachable ?? null);
          setAppOfflineState(!online);
        });
      }
    } catch (error) {
      console.warn('Failed to add network listener:', error);
    }

    const interval = setInterval(checkNetworkState, 15000);

    return () => {
      if (subscription) {
        subscription.remove();
      }
      clearInterval(interval);
    };
  }, [checkNetworkState]);

  return (
    <NetworkContext.Provider
      value={{
        isOnline,
        isOffline: !isOnline,
        networkType,
        isInternetReachable,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = (): NetworkContextType => {
  const context = useContext(NetworkContext);
  if (!context) {
    return { isOnline: true, isOffline: false, networkType: null, isInternetReachable: null };
  }
  return context;
};
