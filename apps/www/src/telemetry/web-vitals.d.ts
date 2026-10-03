declare module 'web-vitals' {
  export type Metric = {
    readonly name: 'CLS' | 'INP' | 'LCP'
    readonly value: number
  }

  export type ReportCallback = (metric: Metric) => void

  export function onCLS(callback: ReportCallback): void
  export function onINP(callback: ReportCallback): void
  export function onLCP(callback: ReportCallback): void
}
