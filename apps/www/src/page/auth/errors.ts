import { Match, Option, Schema } from 'effect'

export const authErrorMessages = {
  credentials: "That email and password don't match. Try again or reset your password.",
  exists: 'An account with this email already exists. Sign in instead.',
  password: 'Use a password between 8 and 128 characters.',
  token: 'This reset link has expired or was already used. Request a new one.',
  rate: 'Too many attempts. Wait a minute and try again.',
  unknown: "That didn't go through. Check your details and try again.",
} as const

export type AuthErrorKey = keyof typeof authErrorMessages

const ErrorBody = Schema.Struct({ code: Schema.String })

export const readAuthErrorCode = async (response: Response): Promise<string> =>
  Option.match(Schema.decodeUnknownOption(ErrorBody)(await response.json().catch(() => null)), {
    onNone: () => '',
    onSome: ({ code }) => code,
  })

export const authErrorKey = (status: number, code: string): AuthErrorKey =>
  status === 429
    ? 'rate'
    : Match.value(code).pipe(
        Match.when('INVALID_EMAIL_OR_PASSWORD', (): AuthErrorKey => 'credentials'),
        Match.whenOr(
          'USER_ALREADY_EXISTS',
          'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
          (): AuthErrorKey => 'exists',
        ),
        Match.whenOr('PASSWORD_TOO_SHORT', 'PASSWORD_TOO_LONG', (): AuthErrorKey => 'password'),
        Match.when('INVALID_TOKEN', (): AuthErrorKey => 'token'),
        Match.orElse((): AuthErrorKey => 'unknown'),
      )

export const authErrorMessage = (key: string | null): string | null =>
  key === null
    ? null
    : (Object.entries(authErrorMessages).find(([name]) => name === key)?.[1] ??
      authErrorMessages.unknown)

export const authErrorLocation = (
  action: string,
  key: AuthErrorKey,
  form: { readonly returnTo: string; readonly token: string },
): string => {
  const params = new URLSearchParams({ error: key })

  if (form.returnTo) params.set('returnTo', form.returnTo)

  if (form.token) params.set('token', form.token)

  return `${action}?${params}`
}
