import { Match } from 'effect'

import type { Metric, Notification, ObjectiveMetric, QueryDiagnostic } from './domain'

export interface EmailMessage {
  readonly from: { readonly email: string; readonly name: string }
  readonly to: string
  readonly subject: string
  readonly html: string
  readonly text: string
}

export interface AlertConfig {
  readonly release: string
  readonly environment: string
  readonly fromEmail: string
  readonly fromName: string
  readonly toEmail: string
  readonly investigationUrl: string
  readonly windowMinutes: number
}

const objectives = {
  availability: {
    name: 'API success rate',
    impact:
      'Some monitored API requests returned server errors. Listeners may be unable to load content or complete an action.',
    action:
      'Check API errors for this release and the affected routes. Compare with the previous release before deciding on a fix or rollback.',
    measure: 'Requests without server errors',
    target: 'at least',
  },
  'api-latency': {
    name: 'API response time',
    impact: 'Slow API responses can delay content loading and listener actions.',
    action:
      'Inspect slow API requests and database calls for this release. Compare with the previous release.',
    measure: '95th-percentile response time',
    target: 'at most',
  },
  'cwv-lcp': {
    name: 'Page loading speed (LCP)',
    impact: 'The main page content may take too long to appear for some listeners.',
    action: 'Check page loading traces, large images and server response times for this release.',
    measure: '75th-percentile largest contentful paint',
    target: 'at most',
  },
  'cwv-inp': {
    name: 'Interaction responsiveness (INP)',
    impact: 'Clicks and taps may feel slow for some listeners.',
    action: 'Inspect long browser tasks and the interactions affected in this release.',
    measure: '75th-percentile interaction to next paint',
    target: 'at most',
  },
  'cwv-cls': {
    name: 'Page layout stability (CLS)',
    impact: 'Unexpected layout shifts may move content or controls while listeners use the page.',
    action:
      'Check images, fonts and dynamically inserted content for layout shifts in this release.',
    measure: '75th-percentile cumulative layout shift',
    target: 'at most',
  },
}

const queryFailures: Record<
  QueryDiagnostic['reason'],
  { readonly detail: string; readonly action: string }
> = {
  network: {
    detail: 'The evaluator could not reach the Cloudflare Analytics SQL API.',
    action:
      'Check the monitoring Worker logs for network failures and Cloudflare service status. Retry the read-only query before changing the website.',
  },
  request: {
    detail: 'The evaluator could not complete the Analytics SQL request.',
    action:
      'Check the monitoring Worker logs and its request configuration. Retry the read-only query.',
  },
  authorization: {
    detail: 'Cloudflare denied access to the telemetry query.',
    action:
      'Check the monitoring token’s Account Analytics Read permission and account scope. Keep credentials out of logs and email.',
  },
  'invalid-query': {
    detail: 'Cloudflare rejected the SQL query or its inputs.',
    action:
      'Review the deployed query against the Cloudflare Analytics SQL contract, including function arguments and types. Test the corrected query read-only.',
  },
  http: {
    detail: 'Cloudflare returned an unsuccessful response to the telemetry query.',
    action:
      'Check the monitoring Worker logs and Cloudflare service status, then retry the read-only query.',
  },
  'invalid-response': {
    detail: 'The query response could not be read as the expected telemetry data.',
    action:
      'Check the response format and evaluator schema in a safe local reproduction. Do not copy raw responses into logs or email.',
  },
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })

const formatValue = (value: number | null, unit: ObjectiveMetric['unit']): string => {
  if (value === null) return 'unavailable'
  const number = new Intl.NumberFormat('en', { maximumFractionDigits: 3 }).format(value)

  return Match.value(unit).pipe(
    Match.when('percent', () => `${number}%`),
    Match.when('milliseconds', () => `${number} ms`),
    Match.orElse(() => number),
  )
}

export const renderNotification = (
  notification: Notification,
  metric: Metric,
  config: AlertConfig,
  metrics: ReadonlyArray<Metric>,
): EmailMessage => {
  const recovered = notification.kind === 'resolved'

  const rows: Array<readonly [string, string]> = [
    ['Scope', `Last ${config.windowMinutes} minutes, current release only`],
  ]

  let title: string
  let summary: string
  let impact: string
  let action: string

  if (metric.signal === 'telemetry-pipeline') {
    if (recovered) {
      title = 'Recent telemetry is available again'
      summary =
        'The API and browser telemetry queries are succeeding, and recent measurements are available again.'
      impact =
        'This clears the monitoring alert only. It does not establish that the website was down or that every performance objective is healthy.'

      const insufficient = metrics.flatMap((item) =>
        item.signal !== 'telemetry-pipeline' && item.status === 'insufficient-volume'
          ? [
              `${objectives[item.signal].name}: ${formatValue(item.samples, 'ratio')} of ${item.minimumSamples} required`,
            ]
          : [],
      )

      const burning = metrics.flatMap((item) =>
        item.signal !== 'telemetry-pipeline' && item.status === 'burning'
          ? [objectives[item.signal].name]
          : [],
      )

      action =
        burning.length > 0
          ? `Investigate the separate active alerts: ${burning.join(', ')}.`
          : 'No action is needed for the recovered monitoring alert. Continue to assess API and browser objectives separately.'

      if (insufficient.length > 0) {
        impact += ' Some objectives still have too few samples to assess.'
        rows.push(['Not enough samples yet', insufficient.join('; ')])
      }

      if (metric.traffic) {
        rows.push(['Estimated API requests', formatValue(metric.traffic.apiRequests, 'ratio')])
        rows.push([
          'Estimated browser measurements',
          `${formatValue(metric.traffic.browserMeasurements, 'ratio')} (LCP, INP and CLS; not unique listeners)`,
        ])
      }
    } else if (metric.status === 'telemetry-silence') {
      title = 'No recent telemetry for this release'
      summary =
        'The queries succeeded, but found no eligible API requests or browser measurements in this window.'
      impact =
        'There is not enough evidence to assess API or browser health. Low traffic or a capture problem could explain the silence; it is not proof of an outage.'
      action =
        'Check whether this release received traffic. If it did, inspect the API and browser telemetry bindings and capture path.'
      rows.push(['Query result', 'Succeeded, no matching measurements'])
    } else {
      title = 'Monitoring cannot read telemetry'
      const diagnostic = metric.diagnostic
      const failure = diagnostic ? queryFailures[diagnostic.reason] : undefined
      summary = failure?.detail ?? 'The evaluator could not query the current release’s telemetry.'
      impact =
        'API and browser health cannot be assessed from this check. This is a monitoring failure, not evidence of a website outage or lost telemetry.'
      action =
        failure?.action ??
        'Check the monitoring Worker logs and retry the read-only telemetry queries.'

      if (diagnostic) {
        rows.push([
          'Failed query',
          diagnostic.dataset === 'api' ? 'API requests' : 'Browser performance',
        ])

        if (diagnostic.httpStatus !== undefined)
          rows.push(['Cloudflare response', `HTTP ${diagnostic.httpStatus}`])
      }
    }
  } else {
    const objective = objectives[metric.signal]
    title = `${objective.name} ${recovered ? 'is back within target' : 'is outside target'}`
    summary = recovered
      ? 'The latest evaluation meets this objective and has enough samples to assess it.'
      : 'The latest evaluation misses this objective and has enough samples to assess it.'
    impact = recovered
      ? 'This alert is resolved for this objective only. Other objectives are evaluated separately.'
      : objective.impact
    action = recovered
      ? 'No action is needed for this objective. Continue monitoring the next evaluation.'
      : objective.action
    rows.push([objective.measure, formatValue(metric.value, metric.unit)])
    rows.push(['Target', `${objective.target} ${formatValue(metric.threshold, metric.unit)}`])
    rows.push([
      'Estimated samples',
      `${formatValue(metric.samples, 'ratio')}; ${metric.minimumSamples} required to assess`,
    ])
  }

  const releaseUrl = /^[a-f0-9]{40}$/i.test(config.release)
    ? `https://github.com/guidefari/gbfm/commit/${config.release}`
    : undefined

  const releaseLabel = releaseUrl ? config.release.slice(0, 8) : config.release
  const status = recovered ? 'RECOVERED' : 'ACTION NEEDED'
  const color = recovered ? '#166534' : '#9f1239'

  const text = [
    `${status}: ${title} (${config.environment})`,
    summary,
    `What this means: ${impact}`,
    `Next action: ${action}`,
    ...rows.map(([label, value]) => `${label}: ${value}`),
    `Monitoring in Cloudflare: ${config.investigationUrl}`,
    `Release: ${releaseUrl ?? config.release}`,
    `Incident reference: ${notification.incidentKey}`,
  ].join('\n\n')

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#f4f4f0;color:#202420;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" style="width:100%;border-collapse:collapse"><tr><td style="padding:24px 12px">
<table role="presentation" style="width:100%;max-width:600px;margin:auto;border-collapse:collapse;background:#ffffff;border-top:4px solid ${color}"><tr><td style="padding:28px 24px">
<p style="margin:0 0 20px;font-size:12px;letter-spacing:1px;color:#626862">GBFM MONITORING · ${escapeHtml(config.environment.toUpperCase())}</p>
<p style="margin:0 0 8px;color:${color};font-size:12px;font-weight:bold">${status}</p>
<h1 style="margin:0 0 16px;font-size:26px;line-height:1.2">${escapeHtml(title)}</h1>
<p style="font-size:16px;line-height:1.5;margin:0 0 24px">${escapeHtml(summary)}</p>
<h2 style="font-size:15px;margin:0 0 8px">What this means</h2><p style="font-size:14px;line-height:1.5;margin:0 0 24px">${escapeHtml(impact)}</p>
<div style="background:#f4f4f0;padding:16px;margin:0 0 24px"><h2 style="font-size:15px;margin:0 0 8px">Next action</h2><p style="font-size:14px;line-height:1.5;margin:0">${escapeHtml(action)}</p></div>
<table style="width:100%;border-collapse:collapse;font-size:13px;line-height:1.5"><caption style="text-align:left;font-weight:bold;padding-bottom:8px">Current evidence</caption>${rows.map(([label, value]) => `<tr><th scope="row" style="width:34%;padding:10px 8px 10px 0;border-top:1px solid #e5e7e2;text-align:left;vertical-align:top;font-weight:normal;color:#626862">${escapeHtml(label)}</th><td style="padding:10px 0;border-top:1px solid #e5e7e2">${escapeHtml(value)}</td></tr>`).join('')}</table>
<p style="margin:24px 0 0;font-size:14px"><a style="color:#185a43" href="${escapeHtml(config.investigationUrl)}">View monitoring in Cloudflare</a></p>
<p style="font-size:12px;color:#626862;line-height:1.5;margin:20px 0 0">Release: ${releaseUrl ? `<a style="color:#626862" href="${escapeHtml(releaseUrl)}">${escapeHtml(releaseLabel)}</a>` : escapeHtml(releaseLabel)}<br>Incident reference: <a href="${escapeHtml(config.investigationUrl)}" style="color:#626862;overflow-wrap:anywhere;word-break:break-all">${escapeHtml(notification.incidentKey)}</a></p>
</td></tr></table></td></tr></table></body></html>`

  return {
    from: { email: config.fromEmail, name: config.fromName },
    to: config.toEmail,
    subject: `[${recovered ? 'RESOLVED' : 'FIRING'}] GBFM: ${title} (${config.environment})`,
    text,
    html,
  }
}
