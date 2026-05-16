import { Button } from '@gbfm/ui'
import { Component, type ReactNode } from 'react'
import { RuntimeClient } from '@/runtime'
import { captureException } from '@/services/analytics'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    void RuntimeClient.runPromise(
      captureException(error, {
        componentStack: errorInfo.componentStack
      })
    )
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className='flex min-h-screen flex-col items-center justify-center gap-4 p-8'>
          <div className='text-center space-y-4'>
            <h1 className='text-2xl font-bold'>Something went wrong</h1>
            <p className='text-muted-foreground max-w-md'>
              We encountered an unexpected error. Please try refreshing the
              page.
            </p>
            {this.state.error && (
              <details className='text-left'>
                <summary className='cursor-pointer text-sm text-muted-foreground hover:text-foreground'>
                  Error details
                </summary>
                <pre className='mt-2 rounded-md bg-muted p-4 text-xs overflow-auto'>
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <div className='flex gap-2 justify-center'>
              <Button onClick={() => window.location.reload()}>
                Reload page
              </Button>
              <Button
                variant='outline'
                onClick={() => {
                  window.location.href = '/'
                }}>
                Go home
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
