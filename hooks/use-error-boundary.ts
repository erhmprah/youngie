import { useState, useCallback } from 'react';
import { reportError, getErrorLog, clearErrorLog } from '@/utils/global-error-handler';

/**
 * Custom hook for error handling in components
 * 
 * Provides error state management and reporting utilities
 * that integrate with the global error boundary system.
 * 
 * @example
 * ```typescript
 * const { error, setError, clearError, reportError: report } = useErrorBoundary();
 * 
 * // In a catch block:
 * } catch (err) {
 *   setError(err as Error);
 *   report(err, 'ComponentName');
 * }
 * ```
 */
export function useErrorBoundary() {
  const [error, setError] = useState<Error | null>(null);
  
  /**
   * Clear the error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  /**
   * Report an error to the global error handler
   */
  const report = useCallback((err: Error | string, context?: string) => {
    const errorObj = typeof err === 'string' ? new Error(err) : err;
    reportError(errorObj, context);
  }, []);
  
  /**
   * Get recent error log
   */
  const getLog = useCallback(() => {
    return getErrorLog();
  }, []);
  
  /**
   * Clear error log
   */
  const clearLog = useCallback(() => {
    clearErrorLog();
  }, []);
  
  return {
    error,
    setError,
    clearError,
    report,
    getLog,
    clearLog,
    hasError: error !== null,
  };
}

export default useErrorBoundary;
