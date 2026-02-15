import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { ViewToken } from 'react-native';

/**
 * Memoization helpers for performance optimization
 */

/**
 * Stable callback hook - prevents unnecessary re-renders
 * Returns a callback that only changes when dependencies change
 */
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: any[] = []
): T {
  return useCallback(callback, deps);
}

/**
 * Creates a stable reference that persists across renders
 * Useful for values that don't need to trigger re-renders
 */
export function useStableRef<T>(value: T): { current: T } {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

/**
 * Lazy initializer for expensive computations
 * Only computes once on mount
 */
export function useLazyInit<T>(factory: () => T): T {
  const ref = useRef<T | null>(null);
  if (ref.current === null) {
    ref.current = factory();
  }
  return ref.current;
}

/**
 * Viewability tracking for FlatList optimization
 * Tracks which items are currently visible
 */
export function useViewabilityTracking(
  onViewableItemsChanged?: (viewableItems: ViewToken[]) => void
) {
  const viewableItemsRef = useRef<ViewToken[]>([]);

  const viewabilityConfig = useMemo(
    () => ({
      itemVisiblePercentThreshold: 50,
      minimumViewTime: 100,
    }),
    []
  );

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      viewableItemsRef.current = viewableItems;
      onViewableItemsChanged?.(viewableItems);
    },
    [onViewableItemsChanged]
  );

  return {
    viewabilityConfig,
    onViewableItemsChanged: handleViewableItemsChanged,
    viewableItems: viewableItemsRef.current,
  };
}

/**
 * Debounced state updates
 */
export function useDebouncedState<T>(
  initialValue: T,
  delay: number = 300
): [T, T, (value: T) => void] {
  const [value, setValue] = useState(initialValue);
  const [debouncedValue, setDebouncedValue] = useState(initialValue);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay]);

  return [debouncedValue, value, setValue];
}

/**
 * Previous value hook - tracks the previous render's value
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

/**
 * Batch updates to reduce re-renders
 */
export function useBatchedUpdates() {
  const queueRef = useRef<(() => void)[]>([]);
  const rafRef = useRef<number | null>(null);

  const flush = useCallback(() => {
    const queue = queueRef.current;
    queueRef.current = [];
    rafRef.current = null;
    queue.forEach((fn) => fn());
  }, []);

  const batch = useCallback((fn: () => void) => {
    queueRef.current.push(fn);
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(flush);
    }
  }, [flush]);

  return { batch };
}
