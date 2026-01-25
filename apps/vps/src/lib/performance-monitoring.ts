/**
 * @deprecated Use the new metrics module at @/lib/metrics instead.
 * This file is kept for backwards compatibility.
 */
export {
  recordHttpRequest as recordRequest,
  recordSystemHealth as checkPerformanceHealth
} from './metrics'
