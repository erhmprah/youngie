import { useState, useEffect, useCallback, useRef } from 'react';
import { cacheService, CACHE_TTL } from '../utils/cache';

interface UseCachedFetchOptions<T> {
  key: string;
  ttl?: number;
  fetchFn: () => Promise<T>;
  // Strategy: 'cache-first' | 'network-first' | 'stale-while-revalidate'
  strategy?: 'cache-first' | 'network-first' | 'stale-while-revalidate';
  enabled?: boolean;
  // Callback when data is fetched from network (for side effects)
  onNetworkFetch?: (data: T) => void;
}

interface UseCachedFetchResult<T> {
  data: T | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  isStale: boolean;
  refresh: () => Promise<void>;
  clearCache: () => Promise<void>;
}

type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * Custom hook for cached data fetching with multiple cache strategies
 * 
 * @param key - Unique cache key for this data
 * @param ttl - Time-to-live in milliseconds
 * @param fetchFn - Function to fetch data from API
 * @param strategy - Cache strategy:
 *   - 'cache-first': Return cached data if available, fetch in background if stale
 *   - 'network-first': Always fetch from network, use cache as fallback
 *   - 'stale-while-revalidate': Return cached data immediately, fetch in background to update
 * @param enabled - Whether to enable fetching
 * @param onNetworkFetch - Callback when data is fetched from network
 */
export function useCachedFetch<T>({
  key,
  ttl = CACHE_TTL.SHORT,
  fetchFn,
  strategy = 'stale-while-revalidate',
  enabled = true,
  onNetworkFetch,
}: UseCachedFetchOptions<T>): UseCachedFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [status, setStatus] = useState<FetchStatus>('idle');
  
  const isMounted = useRef(true);
  const fetchInProgress = useRef(false);

  const fetchData = useCallback(async (isBackground: boolean = false) => {
    if (fetchInProgress.current && isBackground) return;
    fetchInProgress.current = true;

    if (!isBackground) {
      setStatus('loading');
      setError(null);
    }

    try {
      // Get cached data
      const { data: cachedData, isExpired } = await cacheService.get<T>(key);
      
      if (isMounted.current) {
        setIsStale(isExpired);
      }

      // Handle based on strategy
      switch (strategy) {
        case 'cache-first':
          // Return cached data if available, even if stale
          if (cachedData !== null) {
            if (isMounted.current) {
              setData(cachedData);
              if (!isBackground) setStatus('success');
            }
            
            // Fetch in background if stale
            if (isExpired && !fetchInProgress.current) {
              fetchData(true);
            }
          } else {
            // No cache, fetch from network
            const networkData = await fetchFn();
            if (isMounted.current) {
              setData(networkData);
              await cacheService.set(key, networkData, ttl);
              if (!isBackground) setStatus('success');
              onNetworkFetch?.(networkData);
            }
          }
          break;

        case 'network-first':
          // Always try network first
          try {
            const networkData = await fetchFn();
            if (isMounted.current) {
              setData(networkData);
              await cacheService.set(key, networkData, ttl);
              if (!isBackground) setStatus('success');
              onNetworkFetch?.(networkData);
            }
          } catch (networkError) {
            // Fallback to cache if network fails
            if (cachedData !== null) {
              if (isMounted.current) {
                setData(cachedData);
                if (!isBackground) setStatus('success');
              }
            } else {
              throw networkError;
            }
          }
          break;

        case 'stale-while-revalidate':
        default:
          // Return cached data immediately
          if (cachedData !== null) {
            if (isMounted.current) {
              setData(cachedData);
              if (!isBackground) setStatus('success');
            }
          }
          
          // Fetch from network and update cache (even if stale)
          if (!isBackground) {
            setIsLoading(false);
          }
          
          try {
            const networkData = await fetchFn();
            if (isMounted.current) {
              setData(networkData);
              setIsStale(false);
              await cacheService.set(key, networkData, ttl);
              if (!isBackground) setStatus('success');
              onNetworkFetch?.(networkData);
            }
          } catch (networkError) {
            // Keep showing cached data on error
            if (isMounted.current && cachedData === null) {
              setError(networkError as Error);
              if (!isBackground) setStatus('error');
            }
          }
          break;
      }

      if (!isBackground && isMounted.current) {
        setIsLoading(false);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err as Error);
        if (!isBackground) {
          setStatus('error');
          setIsLoading(false);
        }
      }
    } finally {
      fetchInProgress.current = false;
    }
  }, [key, ttl, fetchFn, strategy, onNetworkFetch]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchData(false);
    if (isMounted.current) {
      setIsRefreshing(false);
    }
  }, [fetchData]);

  const clearCache = useCallback(async () => {
    await cacheService.remove(key);
    if (isMounted.current) {
      setData(null);
      setIsStale(false);
    }
  }, [key]);

  // Initial fetch
  useEffect(() => {
    isMounted.current = true;
    
    if (enabled) {
      setIsLoading(true);
      fetchData(false);
    }

    return () => {
      isMounted.current = false;
    };
  }, [key, enabled]);

  // Reset loading state when key changes
  useEffect(() => {
    if (status === 'idle' && enabled) {
      setIsLoading(true);
    }
  }, [key]);

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    isStale,
    refresh,
    clearCache,
  };
}

/**
 * Hook for simple key-value caching
 */
export function useSimpleCache<T>(key: string, ttl: number = CACHE_TTL.SHORT) {
  const getCached = useCallback(async () => {
    const { data } = await cacheService.get<T>(key);
    return data;
  }, [key]);

  const setCached = useCallback(async (value: T) => {
    await cacheService.set(key, value, ttl);
  }, [key, ttl]);

  const clearCached = useCallback(async () => {
    await cacheService.remove(key);
  }, [key]);

  return { getCached, setCached, clearCached };
}
