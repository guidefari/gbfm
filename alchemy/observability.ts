import type { WorkerObservability } from 'alchemy/Cloudflare'

const LOGS_DESTINATION = 'planetaryescape-logs'

const TRACES_DESTINATION = 'planetaryescape-traces'

export function workerObservability(isProduction: boolean): WorkerObservability {
  if (isProduction) {
    return {
      enabled: true,
      logs: {
        enabled: true,
        headSamplingRate: 1,
        invocationLogs: true,
        persist: false,
        destinations: [LOGS_DESTINATION],
      },
      traces: {
        enabled: true,
        headSamplingRate: 1,
        persist: false,
        destinations: [TRACES_DESTINATION],
      },
    }
  }

  return {
    enabled: true,
    logs: {
      enabled: true,
      headSamplingRate: 1,
      invocationLogs: true,
      persist: true,
    },
    traces: {
      enabled: true,
      headSamplingRate: 1,
      persist: true,
    },
  }
}
