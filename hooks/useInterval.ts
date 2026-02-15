import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Custom hook for setInterval with automatic cleanup
 * Prevents memory leaks from uncleaned intervals
 */
export function useInterval(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback);
  
  // Update the callback ref when it changes
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);
  
  // Set up and clean up the interval
  useEffect(() => {
    // Don't run if delay is null or negative
    if (delay === null || typeof delay !== 'number') {
      return;
    }
    
    const id = setInterval(() => {
      savedCallback.current();
    }, delay);
    
    // Cleanup function - clears interval on unmount or when delay changes
    return () => {
      clearInterval(id);
    };
  }, [delay]);
}

/**
 * Custom hook for setTimeout with automatic cleanup
 * Prevents memory leaks from uncleaned timeouts
 */
export function useTimeout(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback);
  
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);
  
  useEffect(() => {
    if (delay === null || typeof delay !== 'number') {
      return;
    }
    
    const id = setTimeout(() => {
      savedCallback.current();
    }, delay);
    
    return () => {
      clearTimeout(id);
    };
  }, [delay]);
}

/**
 * Custom hook for debouncing values
 * Useful for search inputs to prevent excessive API calls
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);
  
  return debouncedValue;
}

/**
 * Custom hook for throttling function calls
 * Limits how often a function can be called
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastRun = useRef(Date.now());
  
  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastRun.current >= delay) {
        lastRun.current = now;
        callback(...args);
      }
    }) as T,
    [callback, delay]
  );
}
