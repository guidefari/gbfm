# Migration Plan: Custom JWT Auth → Better Auth

## Overview

Migrate from custom JWT-based authentication to Better Auth with session-based authentication. This is a **clean cut migration** (no backward compatibility) with automatic user data migration.

**Current System**: Custom JWT tokens (access 15min + refresh 7d) with Bun.password hashing
**Target System**: Better Auth session-based (7d sessions) with bcrypt password compatibility
**Affected Clients**: WWW (React), Mobile (Expo), Raycast extension

---

## Phase 1: Backend Setup (apps/vps)

### 1.1 Install Dependencies

```bash
cd apps/vps
bun add better-auth bcrypt
bun add -D @types/bcrypt
```

### 1.2 Create Better Auth Configuration

**New file: `apps/vps/src/lib/auth.ts`**

```typescript
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import bcrypt from 'bcrypt'
import { db } from '@/db'
import { env } from '@/env'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg'
  }),
  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (password) => {
        return await bcrypt.hash(password, 10)
      },
      verify: async ({ hash, password }) => {
        if (!hash) return false
        return await bcrypt.compare(password, hash)
      }
    }
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60 // 5 minutes
    }
  },
  trustedOrigins: [
    env.FRONTEND_URL,
    'http://127.0.0.1:5173',
    /^exp:\/\/.+$/ // Expo dev
  ],
  advanced: {
    cookieSameSite: 'lax'
  }
})

export type AuthSession = typeof auth.$Infer.Session
```

### 1.3 Generate Better Auth Schema

```bash
cd apps/vps
bunx @better-auth/cli generate
```

This creates Better Auth tables in your Drizzle schema:

- `user` - Better Auth user table
- `session` - Session management
- `account` - Credential storage (includes password field)
- `verification` - Email verification tokens

### 1.4 Mount Better Auth Handler

**New file: `apps/vps/src/routes/auth/better-auth.routes.ts`**

```typescript
import { Hono } from 'hono'
import { auth } from '@/lib/auth'

const betterAuthApp = new Hono()

betterAuthApp.all('*', async (c) => {
  return auth.handler(c.req.raw)
})

export default betterAuthApp
```

**Update: `apps/vps/src/app.ts`**

```typescript
import betterAuthRoutes from '@/routes/auth/better-auth.routes'

// Mount Better Auth at /api/auth
app.route('/api/auth', betterAuthRoutes)
```

### 1.5 Create New Middleware

**New file: `apps/vps/src/middlewares/better-auth.middleware.ts`**

```typescript
import type { Context, Next } from 'hono'
import { auth } from '@/lib/auth'
import type { AppBindings } from '@/lib/types'

export const betterAuthMiddleware = async (c: Context<AppBindings>, next: Next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers
  })

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  c.set('user', session.user)
  c.set('session', session.session)
  await next()
}
```

### 1.6 Update Environment Variables

**Add to `apps/vps/src/env.ts`:**

```typescript
BETTER_AUTH_SECRET: z.string(),
BETTER_AUTH_URL: z.string().url(),
```

**Add to `.env`:**

```bash
BETTER_AUTH_SECRET=your-secret-key-min-32-chars
BETTER_AUTH_URL=http://127.0.0.1:3003
```

---

## Phase 2: Database Migration

### 2.1 Run Drizzle Migrations

```bash
cd apps/vps
bun db:gen    # Generate migration files
bun db:migrate # Apply migrations
```

### 2.2 Migrate Existing Users

**New file: `apps/vps/scripts/migrate-users-to-better-auth.ts`**

```typescript
import { db } from '../src/db'
import { usersTable } from '../src/db/user.schema'
import { Effect, Console } from 'effect'
import { BunRuntime } from '@effect/platform-bun'

const migrateUsers = Effect.gen(function* (_) {
  yield* _(Console.log('🔄 Starting user migration...'))

  const existingUsers = yield* _(Effect.promise(() => db.select().from(usersTable)))

  for (const user of existingUsers) {
    yield* _(
      Effect.promise(async () => {
        await db.transaction(async (tx) => {
          // Create Better Auth user
          await tx.insert(betterAuthUser).values({
            id: user.id,
            name: user.name,
            email: user.email,
            emailVerified: user.verified,
            image: user.avatarUrl,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
          })

          // Store password in account table
          if (user.password) {
            await tx.insert(betterAuthAccount).values({
              id: `${user.id}-credential`,
              accountId: user.email,
              providerId: 'credential',
              userId: user.id,
              password: user.password // Existing bcrypt hash
            })
          }
        })
      })
    )
  }

  yield* _(Console.log(`✅ Migrated ${existingUsers.length} users`))
})

migrateUsers.pipe(BunRuntime.runMain)
```

**Run migration:**

```bash
bun run scripts/migrate-users-to-better-auth.ts
```

---

## Phase 3: Client Updates

### 3.1 WWW Client (apps/www)

**Install:**

```bash
cd apps/www
bun add better-auth
```

**New file: `apps/www/src/lib/auth-client.ts`**

```typescript
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_VPS_BASE_URL
})

export const { signIn, signUp, signOut, useSession } = authClient
```

**Update: `apps/www/src/store/auth.ts`**

Replace entire JWT token management with:

```typescript
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { authClient } from '@/lib/auth-client'

interface User {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
}

interface AuthStore {
  user: User | null
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  clearAuth: () => void
  refreshSession: () => Promise<void>
}

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        isAuthenticated: false,

        setUser: (user) =>
          set({
            user,
            isAuthenticated: !!user
          }),

        clearAuth: () =>
          set({
            user: null,
            isAuthenticated: false
          }),

        refreshSession: async () => {
          const session = await authClient.getSession()
          if (session.data) {
            set({
              user: session.data.user,
              isAuthenticated: true
            })
          } else {
            set({
              user: null,
              isAuthenticated: false
            })
          }
        }
      }),
      { name: 'auth-store' }
    )
  )
)
```

**Update: `apps/www/src/lib/http.ts`**

Remove JWT token logic:

```typescript
export async function fetcher<T>(input: RequestInfo, init: RequestInit = {}) {
  const res = await fetch(input, {
    ...init,
    credentials: 'include' // Important for cookies
  })

  if (res.status === 401) {
    useAuthStore.getState().clearAuth()
    window.location.href = '/auth/signin'
  }

  return res.json() as Promise<T>
}
```

**Update login/signup components:**

```typescript
import { signIn, signUp } from '@/lib/auth-client'

// Login
const result = await signIn.email({ email, password })
if (result.data) {
  setUser(result.data.user)
}

// Signup
const result = await signUp.email({ email, password, name })
if (result.data) {
  setUser(result.data.user)
}
```

### 3.2 Mobile Client (apps/mobile)

**Install:**

```bash
cd apps/mobile
bun add better-auth @better-auth/expo expo-secure-store
```

**New file: `apps/mobile/src/lib/auth-client.ts`**

```typescript
import { createAuthClient } from 'better-auth/react'
import { expoClient } from '@better-auth/expo/client'

export const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  plugins: [expoClient()]
})
```

**Update: `apps/mobile/src/store/auth.ts`**

```typescript
import { create } from 'zustand'
import { authClient } from '@/lib/auth-client'

interface AuthStore {
  user: User | null
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  clearAuth: () => void
  refreshSession: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  clearAuth: () => set({ user: null, isAuthenticated: false }),

  refreshSession: async () => {
    const session = await authClient.getSession()
    if (session.data) {
      set({ user: session.data.user, isAuthenticated: true })
    }
  }
}))
```

**Update: `apps/mobile/src/components/Login.tsx`**

```typescript
import { authClient } from '@/lib/auth-client'

const handleLogin = async () => {
  const result = await authClient.signIn.email({ email, password })
  if (result.data) {
    setUser(result.data.user)
    router.push('/profile')
  }
}
```

### 3.3 Raycast Client (apps/raycast)

**Challenge**: Raycast can't use cookies like browsers. Solution: Extract session token manually.

**Update: `apps/raycast/src/api-client.ts`**

```typescript
import { LocalStorage } from '@raycast/api'

const getConfiguration = async () => {
  const [baseUrl, sessionToken] = await Promise.all([
    LocalStorage.getItem<string>('gbfm-base-url'),
    LocalStorage.getItem<string>('gbfm-session-token')
  ])

  return { baseUrl, sessionToken }
}

export const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
  const config = await getConfiguration()
  const fullUrl = `${config.baseUrl}${url}`

  const headers = {
    'Content-Type': 'application/json',
    ...(config.sessionToken && {
      Cookie: `better-auth.session_token=${config.sessionToken}`
    }),
    ...options.headers
  }

  const response = await fetch(fullUrl, {
    ...options,
    headers,
    credentials: 'include'
  })

  if (response.status === 401) {
    await LocalStorage.removeItem('gbfm-session-token')
    throw new Error('Session expired')
  }

  return response
}
```

**Update: `apps/raycast/src/sign-in.tsx`**

```typescript
const handleSubmit = async (values: SignInData) => {
  const response = await fetch(`${values.baseUrl}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: values.email, password: values.password }),
    credentials: 'include'
  })

  const result = await response.json()

  // Extract session token from Set-Cookie header
  const cookies = response.headers.get('set-cookie')
  const sessionToken = cookies?.match(/better-auth\.session_token=([^;]+)/)?.[1]

  if (!sessionToken) throw new Error('No session token')

  await Promise.all([
    LocalStorage.setItem('gbfm-base-url', values.baseUrl),
    LocalStorage.setItem('gbfm-session-token', sessionToken),
    LocalStorage.setItem('gbfm-user', JSON.stringify(result.user))
  ])
}
```

---

## Phase 4: Update Protected Routes

### 4.1 Replace Middleware

**Find all files using old middleware:**

```bash
cd apps/vps
grep -r "authenticate" src/routes/
```

**Replace imports:**

```typescript
// Old
import { authenticate } from '@/middlewares/auth.middleware'

// New
import { betterAuthMiddleware } from '@/middlewares/better-auth.middleware'
```

**Update route definitions:**

```typescript
// Old
protectedRoutes.use('*', authenticate)

// New
protectedRoutes.use('*', betterAuthMiddleware)
```

### 4.2 Update Type Definitions

**Update: `apps/vps/src/lib/types.ts`**

```typescript
import type { AuthSession } from '@/lib/auth'

export type AppBindings = {
  Variables: {
    user: AuthSession['user']
    session: AuthSession['session']
  }
}
```

---

## Phase 5: CORS Configuration

**Update: `apps/vps/src/app.ts`**

```typescript
import { cors } from 'hono/cors'

app.use(
  '/*',
  cors({
    origin: [
      'http://127.0.0.1:5173',
      'https://goosebumps.fm',
      /^exp:\/\/.+$/ // Expo
    ],
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowHeaders: ['Content-Type', 'Authorization', 'Cookie']
  })
)
```

---

## Phase 6: Remove Old Auth System

### 6.1 Delete Old Files

- `apps/vps/src/routes/auth/auth.handlers.ts`
- `apps/vps/src/routes/auth/auth.routes.ts`
- `apps/vps/src/routes/auth/auth.util.ts` (keep `uploadAvatar` if needed elsewhere)
- `apps/vps/src/middlewares/auth.middleware.ts`
- `packages/core/src/api/auth.ts`

### 6.2 Clean Up Old Tables (After Confirming Migration Works)

```bash
# Create migration to drop old tables
cd apps/vps
bunx drizzle-kit generate
```

Drop these tables:

- `user_sessions`
- `user_password_reset_tokens`

**Note**: Keep `users` table for reference, or migrate username field to Better Auth user table if needed.

---

## Testing Strategy

### Backend Tests

```bash
# Test signup
curl -X POST http://127.0.0.1:3003/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'

# Test signin (save cookies)
curl -X POST http://127.0.0.1:3003/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  -c cookies.txt

# Test protected endpoint
curl http://127.0.0.1:3003/auth/profile \
  -b cookies.txt
```

### Frontend Tests

**WWW**:

1. ✓ Login flow works
2. ✓ Session persists on refresh
3. ✓ Protected pages redirect to login when unauthenticated
4. ✓ Logout clears session

**Mobile**:

1. ✓ Login stores session in SecureStore
2. ✓ Session persists across app restarts
3. ✓ API calls include session automatically

**Raycast**:

1. ✓ Sign in extracts session token
2. ✓ Commands use session token
3. ✓ Session expiration handled gracefully

### Migration Tests

1. ✓ All existing users migrated successfully
2. ✓ Users can login with existing passwords
3. ✓ Sessions created correctly
4. ✓ No data loss
5. ✓ Old user metadata preserved (name, email, verified, avatarUrl)

---

## Deployment Checklist

### Pre-Deployment

- [ ] Backup production database
- [ ] Test migration on staging environment
- [ ] Verify all tests pass
- [ ] Update environment variables in production
- [ ] Announce maintenance window to users

### Deployment Steps

1. Deploy VPS with Better Auth
2. Run database migrations (`bun db:migrate:prod`)
3. Run user migration script
4. Deploy WWW client
5. Deploy Mobile app update
6. Release Raycast extension update

### Post-Deployment

- [ ] Monitor error logs
- [ ] Verify user logins working
- [ ] Check session creation
- [ ] Monitor performance metrics
- [ ] Confirm all clients authenticating successfully

---

## Critical Files to Modify

**Backend:**

- `apps/vps/src/lib/auth.ts` (new)
- `apps/vps/src/routes/auth/better-auth.routes.ts` (new)
- `apps/vps/src/middlewares/better-auth.middleware.ts` (new)
- `apps/vps/scripts/migrate-users-to-better-auth.ts` (new)
- `apps/vps/src/app.ts` (update CORS + mount handler)
- `apps/vps/src/env.ts` (add Better Auth env vars)
- `apps/vps/src/lib/types.ts` (update AppBindings)

**WWW Client:**

- `apps/www/src/lib/auth-client.ts` (new)
- `apps/www/src/store/auth.ts` (replace)
- `apps/www/src/lib/http.ts` (update)
- `apps/www/src/routes/auth/sign-in.tsx` (update)
- `apps/www/src/routes/auth/sign-up.tsx` (update)

**Mobile Client:**

- `apps/mobile/src/lib/auth-client.ts` (new)
- `apps/mobile/src/store/auth.ts` (update)
- `apps/mobile/src/components/Login.tsx` (update)

**Raycast:**

- `apps/raycast/src/api-client.ts` (update)
- `apps/raycast/src/sign-in.tsx` (update)

**Database:**

- Run `bunx @better-auth/cli generate` to create schema
- Run migration script to copy users to Better Auth tables

---

## Key Migration Decisions

✅ **Session-based auth**: Better Auth's recommended approach
✅ **7-day sessions**: Matches current refresh token expiry
✅ **bcrypt passwords**: Compatible with existing Bun.password hashes
✅ **Automatic migration**: All users migrated in one go
✅ **Clean cut**: No backward compatibility needed
✅ **Email/password only**: OAuth can be added later

## Rollback Plan

If critical issues occur:

1. Restore database backup
2. Revert VPS deployment
3. Revert client deployments
4. Re-enable old auth routes

## Timeline Estimate

- Backend setup: 1 day
- Database migration: 1 day
- Client updates: 2-3 days
- Testing: 2 days
- Deployment: 1 day

**Total: ~7 days**
