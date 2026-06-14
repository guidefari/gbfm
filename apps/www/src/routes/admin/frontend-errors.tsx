import { Button, Card, CardContent, CardHeader, CardTitle } from '@gbfm/ui'
import { createFileRoute } from '@tanstack/react-router'
import { AlertTriangle, CheckCircle2, RadioTower } from 'lucide-react'
import * as React from 'react'
import { fetcher, VPS_BASE_URL } from '@/lib/http'
import { AdminPage } from './_components/-AdminLayout'

export const Route = createFileRoute('/admin/frontend-errors')({
  component: FrontendErrorsPage
})

type DemoResult = {
  label: string
  ok: boolean
  message: string
}

type Scenario = {
  label: string
  description: string
  scenario: 'ok' | 'bad-request' | 'not-found' | 'rate-limit' | 'error' | 'unavailable'
  shouldReport: boolean
}

const scenarios: Scenario[] = [
  {
    label: '200 OK',
    description: 'Confirms the helper endpoint is reachable.',
    scenario: 'ok',
    shouldReport: false
  },
  {
    label: '400 Bad Request',
    description: 'Throws in the UI but should stay quiet in Sentry.',
    scenario: 'bad-request',
    shouldReport: false
  },
  {
    label: '404 Not Found',
    description: 'Expected missing-resource behavior; should stay quiet.',
    scenario: 'not-found',
    shouldReport: false
  },
  {
    label: '429 Rate Limit',
    description: 'Expected throttling behavior; should stay quiet.',
    scenario: 'rate-limit',
    shouldReport: false
  },
  {
    label: '500 Server Error',
    description: 'Reports to Sentry through the shared frontend fetcher.',
    scenario: 'error',
    shouldReport: true
  },
  {
    label: '503 Unavailable',
    description: 'Reports to Sentry and mirrors the backend incident case.',
    scenario: 'unavailable',
    shouldReport: true
  }
]

function FrontendErrorsPage() {
  const [pending, setPending] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<DemoResult | null>(null)

  const runScenario = async (scenario: Scenario) => {
    setPending(scenario.label)
    setResult(null)

    try {
      await fetcher<unknown>(`${VPS_BASE_URL}/admin/frontend-errors/${scenario.scenario}`)
      setResult({
        label: scenario.label,
        ok: true,
        message: 'Request completed successfully.'
      })
    } catch (error) {
      setResult({
        label: scenario.label,
        ok: false,
        message: error instanceof Error ? error.message : String(error)
      })
    } finally {
      setPending(null)
    }
  }

  const runNetworkFailure = async () => {
    setPending('Network failure')
    setResult(null)

    try {
      await fetcher<unknown>('https://127.0.0.1:1/gbfm-frontend-error-demo')
      setResult({
        label: 'Network failure',
        ok: true,
        message: 'Unexpectedly completed successfully.'
      })
    } catch (error) {
      setResult({
        label: 'Network failure',
        ok: false,
        message: error instanceof Error ? error.message : String(error)
      })
    } finally {
      setPending(null)
    }
  }

  return (
    <AdminPage
      title='Frontend Errors'
      description='Simulate frontend-observed API failures and confirm which ones report to Sentry through the shared fetcher.'
      backToAdmin
      maxWidth='max-w-5xl'>
      <Card>
        <CardHeader>
          <CardTitle>API response scenarios</CardTitle>
        </CardHeader>
        <CardContent className='grid gap-3 md:grid-cols-2'>
          {scenarios.map((scenario) => (
            <div key={scenario.scenario} className='flex flex-col gap-3 rounded-lg border p-4'>
              <div className='flex items-start justify-between gap-3'>
                <div>
                  <div className='font-semibold'>{scenario.label}</div>
                  <p className='mt-1 text-sm text-muted-foreground'>{scenario.description}</p>
                </div>
                <div className='shrink-0 rounded-full border px-2 py-1 text-xs text-muted-foreground'>
                  {scenario.shouldReport ? 'Sentry' : 'Quiet'}
                </div>
              </div>
              <Button
                variant={scenario.shouldReport ? 'destructive' : 'outline'}
                onClick={() => runScenario(scenario)}
                disabled={Boolean(pending)}>
                {pending === scenario.label ? 'Running...' : 'Run scenario'}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Network failure</CardTitle>
        </CardHeader>
        <CardContent className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <p className='font-semibold'>Failed fetch / unreachable host</p>
            <p className='mt-1 text-sm text-muted-foreground'>
              Calls an unreachable loopback URL to trigger the fetcher network failure reporting
              path.
            </p>
          </div>
          <Button variant='destructive' onClick={runNetworkFailure} disabled={Boolean(pending)}>
            {pending === 'Network failure' ? 'Running...' : 'Run network failure'}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardContent className='flex items-start gap-3 py-5'>
            {result.ok ? (
              <CheckCircle2 className='mt-0.5 h-5 w-5 text-green-600' />
            ) : result.label.includes('500') ||
              result.label.includes('503') ||
              result.label === 'Network failure' ? (
              <RadioTower className='mt-0.5 h-5 w-5 text-destructive' />
            ) : (
              <AlertTriangle className='mt-0.5 h-5 w-5 text-muted-foreground' />
            )}
            <div>
              <div className='font-semibold'>{result.label}</div>
              <p className='mt-1 text-sm text-muted-foreground'>{result.message}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </AdminPage>
  )
}
