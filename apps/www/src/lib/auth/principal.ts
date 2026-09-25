import { Schema } from 'effect'

const Role = Schema.Literals(['user', 'creator', 'editor', 'admin'])

const AuthenticatedUser = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  role: Schema.optional(Schema.NullOr(Role)),
  image: Schema.optional(Schema.NullOr(Schema.String)),
  username: Schema.optional(Schema.NullOr(Schema.String)),
  emailVerified: Schema.optional(Schema.Boolean)
})

const SessionResponse = Schema.Struct({
  user: AuthenticatedUser,
  session: Schema.Unknown
})

export type AnonymousPrincipal = { readonly _tag: 'Anonymous' }

export type AuthenticatedPrincipal = {
  readonly _tag: 'Authenticated'
  readonly userId: string
  readonly name: string
  readonly email: string
  readonly role: typeof Role.Type
  readonly imageUrl: string | undefined
  readonly username: string | undefined
  readonly emailVerified: boolean
}

export type Principal = AnonymousPrincipal | AuthenticatedPrincipal

export const anonymousPrincipal: AnonymousPrincipal = { _tag: 'Anonymous' }

/** Parses Better Auth's session response into the app's minimal principal. */
export function parsePrincipal(input: Schema.Json): Principal {
  if (input === null) return anonymousPrincipal

  const { user } = Schema.decodeUnknownSync(SessionResponse)(input)
  const principal: AuthenticatedPrincipal = {
    _tag: 'Authenticated',
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role ?? 'user',
    imageUrl: user.image ?? undefined,
    username: user.username ?? undefined,
    emailVerified: user.emailVerified ?? false
  }
  return principal
}
