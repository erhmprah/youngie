/**
 * API Cache - Response caching and request deduplication
 * Improves performance by caching API responses
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
}

class APICache {
  private cache = new Map<string, CacheEntry<any>>();
  private pendingRequests = new Map<string, PendingRequest>();
  private DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private DEDUP_WINDOW = 2000; // 2 seconds

  /**
   * Get cached data if available and not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > this.DEFAULT_TTL;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cached data
   */
  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Check if a key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Invalidate by exact key
   */
  invalidateExact(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Execute a request with caching
   * Returns cached data if available, otherwise fetches and caches
   */
  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Check cache first
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Check for pending request (deduplication)
    const pending = this.pendingRequests.get(key);
    if (pending && Date.now() - pending.timestamp < this.DEDUP_WINDOW) {
      return pending.promise;
    }

    // Execute fetch
    const promise = fetchFn().then((data) => {
      this.set(key, data, ttl);
      this.pendingRequests.delete(key);
      return data;
    }).catch((error) => {
      this.pendingRequests.delete(key);
      throw error;
    });

    // Store pending request
    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now(),
    });

    return promise;
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance
export const apiCache = new APICache();

/**
 * Create a cached API function
 */
export function createCachedApiFunction<T>(
  fetchFn: (params?: any) => Promise<T>,
  ttl?: number
) {
  return async (params?: any): Promise<T> => {
    const cacheKey = JSON.stringify({ fn: fetchFn.name, params });
    return apiCache.getOrFetch(cacheKey, () => fetchFn(params), ttl);
  };
}

/**
 * Hook for using cache in components
 */
export function useApiCache() {
  return apiCache;
}
