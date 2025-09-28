export interface ApiError {
  error: string
  details?: unknown
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface AuthResponse {
  user: {
    id: string
    name: string
    email: string
    username?: string
    avatarUrl?: string
  }
  accessToken: string
  refreshToken: string
}

export interface RefreshTokenResponse {
  accessToken: string
}

export interface ApiConfiguration {
  baseUrl: string
  accessToken: string
  refreshToken?: string
}

export class NetworkError extends Error {
  constructor(
    message: string,
    public cause?: unknown
  ) {
    super(message)
    this.name = 'NetworkError'
  }
}

export class AuthenticationError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message)
    this.name = 'AuthenticationError'
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public details: unknown
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class ServerError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message)
    this.name = 'ServerError'
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigurationError'
  }
}
