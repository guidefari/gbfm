import { LocalStorage } from '@raycast/api'
import { Effect } from 'effect'
import {
  type ApiConfiguration,
  type ApiError,
  AuthenticationError,
  ConfigurationError,
  NetworkError,
  ServerError,
  ValidationError
} from './types/api'

const Runtime = {
  defaultRuntime: undefined,
  runSync:
    (_runtime: unknown) =>
    <A, E>(effect: Effect.Effect<A, E>) =>
      Effect.runSync(effect),
  runPromise:
    (_runtime: unknown) =>
    <A, E>(effect: Effect.Effect<A, E>) =>
      Effect.runPromise(effect)
}

const getConfiguration = async (): Promise<ApiConfiguration> => {
  const [baseUrl, accessToken, refreshToken] = await Promise.all([
    LocalStorage.getItem<string>('gbfm-base-url'),
    LocalStorage.getItem<string>('gbfm-access-token'),
    LocalStorage.getItem<string>('gbfm-refresh-token')
  ])

  if (!baseUrl || !accessToken) {
    throw new ConfigurationError(
      'API configuration missing. Please configure and sign in first.'
    )
  }

  return {
    baseUrl,
    accessToken,
    refreshToken: refreshToken || undefined
  }
}

const refreshAccessToken = async (
  baseUrl: string,
  currentToken: string
): Promise<string> => {
  Runtime.runSync(Runtime.defaultRuntime)(
    Effect.logInfo('Attempting to refresh session via get-session')
  )

  // Better Auth doesn't have a separate refresh endpoint.
  // Call get-session with the bearer token to validate/extend the session.
  const response = await fetch(`${baseUrl}/auth/get-session`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${currentToken}`,
      Origin: baseUrl
    }
  })

  if (!response.ok) {
    Runtime.runSync(Runtime.defaultRuntime)(
      Effect.logError('Session refresh failed', {
        status: response.status,
        statusText: response.statusText
      })
    )

    throw new AuthenticationError(
      'Session expired. Please sign in again.',
      response.status
    )
  }

  // Check if Better Auth returned a new bearer token in the header
  const newToken = response.headers.get('set-auth-token')
  const accessToken = newToken || currentToken

  if (newToken) {
    await LocalStorage.setItem('gbfm-access-token', accessToken)
    Runtime.runSync(Runtime.defaultRuntime)(
      Effect.logInfo('Session refreshed with new token')
    )
  } else {
    Runtime.runSync(Runtime.defaultRuntime)(
      Effect.logInfo('Session still valid, keeping current token')
    )
  }

  return accessToken
}

const makeRequest = async (
  url: string,
  options: RequestInit,
  accessToken: string
): Promise<Response> => {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    ...options.headers
  }

  Runtime.runSync(Runtime.defaultRuntime)(
    Effect.logDebug('Making HTTP request', {
      url,
      method: options.method || 'GET',
      hasBody: Boolean(options.body)
    })
  )

  const response = await fetch(url, {
    ...options,
    headers
  })

  Runtime.runSync(Runtime.defaultRuntime)(
    Effect.logDebug('Received HTTP response', {
      status: response.status,
      statusText: response.statusText,
      url: response.url
    })
  )

  if (response.status >= 500) {
    Runtime.runSync(Runtime.defaultRuntime)(
      Effect.logError('Server error response', {
        status: response.status,
        statusText: response.statusText
      })
    )
    throw new ServerError('Server error', response.status)
  }

  if (response.status === 422) {
    const errorData = (await response
      .json()
      .catch(() => ({ error: 'Validation error' }))) as ApiError

    Runtime.runSync(Runtime.defaultRuntime)(
      Effect.logError('Validation error', { errorData })
    )
    throw new ValidationError(errorData.error, errorData.details)
  }

  return response
}

export const authenticatedFetch = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  Runtime.runSync(Runtime.defaultRuntime)(
    Effect.logInfo('Starting authenticated request', {
      url,
      method: options.method || 'GET'
    })
  )

  const config = await getConfiguration()
  const fullUrl = url.startsWith('http') ? url : `${config.baseUrl}${url}`

  try {
    const response = await makeRequest(fullUrl, options, config.accessToken)

    if (response.ok) {
      Runtime.runSync(Runtime.defaultRuntime)(
        Effect.logInfo('Request completed successfully', {
          status: response.status,
          url: fullUrl
        })
      )
      return response
    }

    if (response.status === 401) {
      Runtime.runSync(Runtime.defaultRuntime)(
        Effect.logWarning('Request failed with 401, attempting token refresh')
      )

      if (!config.refreshToken) {
        Runtime.runSync(Runtime.defaultRuntime)(
          Effect.logError('No refresh token available for token refresh')
        )
        throw new AuthenticationError('No refresh token available', 401)
      }

      Runtime.runSync(Runtime.defaultRuntime)(
        Effect.logInfo('Attempting token refresh due to 401 response')
      )

      const newAccessToken = await refreshAccessToken(
        config.baseUrl,
        config.refreshToken
      )

      Runtime.runSync(Runtime.defaultRuntime)(
        Effect.logInfo('Retrying original request with new token')
      )

      const retryResponse = await makeRequest(fullUrl, options, newAccessToken)

      if (!retryResponse.ok && retryResponse.status === 401) {
        Runtime.runSync(Runtime.defaultRuntime)(
          Effect.logError('Request still unauthorized after token refresh')
        )
        throw new AuthenticationError(
          'Authentication failed after token refresh',
          401
        )
      }

      Runtime.runSync(Runtime.defaultRuntime)(
        Effect.logInfo('Retry request completed successfully', {
          status: retryResponse.status,
          url: fullUrl
        })
      )

      return retryResponse
    }

    if (response.status === 403) {
      const errorData = (await response
        .json()
        .catch(() => ({ error: 'Forbidden' }))) as ApiError

      Runtime.runSync(Runtime.defaultRuntime)(
        Effect.logError('Forbidden response', {
          status: response.status,
          errorData
        })
      )
      throw new ValidationError(errorData.error, errorData.details)
    }

    if (response.status >= 400 && response.status < 500) {
      const errorData = (await response
        .json()
        .catch(() => ({ error: 'Client error' }))) as ApiError

      Runtime.runSync(Runtime.defaultRuntime)(
        Effect.logError('Client error response', {
          status: response.status,
          errorData
        })
      )
      throw new AuthenticationError(errorData.error, response.status)
    }

    return response
  } catch (error) {
    if (
      error instanceof NetworkError ||
      error instanceof AuthenticationError ||
      error instanceof ServerError ||
      error instanceof ValidationError ||
      error instanceof ConfigurationError
    ) {
      throw error
    }

    Runtime.runSync(Runtime.defaultRuntime)(
      Effect.logError('Unexpected error in authenticated fetch', { error })
    )
    throw new NetworkError('Network request failed')
  }
}

export const get = (url: string): Promise<Response> =>
  authenticatedFetch(url, { method: 'GET' })

export const post = <T>(url: string, body: T): Promise<Response> =>
  authenticatedFetch(url, {
    method: 'POST',
    body: JSON.stringify(body)
  })

export const put = <T>(url: string, body: T): Promise<Response> =>
  authenticatedFetch(url, {
    method: 'PUT',
    body: JSON.stringify(body)
  })

export const patch = <T>(url: string, body: T): Promise<Response> =>
  authenticatedFetch(url, {
    method: 'PATCH',
    body: JSON.stringify(body)
  })

export const del = (url: string): Promise<Response> =>
  authenticatedFetch(url, { method: 'DELETE' })

export const parseJsonResponse = async <T>(response: Response): Promise<T> => {
  try {
    return (await response.json()) as T
  } catch (_error) {
    throw new ServerError('Failed to parse JSON response', 500)
  }
}
