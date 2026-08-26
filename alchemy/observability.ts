import type { WorkerObservability } from 'alchemy/Cloudflare'

const LOGS_DESTINATION = 'planetaryescape-logs'
const TRACES_DESTINATION = 'planetaryescape-traces'

export function workerObservability(isProduction: boolean): WorkerObservability {
  return {
    enabled: true,
    logs: {
      enabled: true,
      headSamplingRate: isProduction ? 0.2 : 1,
      invocationLogs: true,
      persist: !isProduction,
      destinations: isProduction ? [LOGS_DESTINATION] : undefined
    },
    traces: {
      enabled: true,
      headSamplingRate: isProduction ? 0.2 : 1,
      persist: !isProduction,
      destinations: isProduction ? [TRACES_DESTINATION] : undefined
    }
  }
}
