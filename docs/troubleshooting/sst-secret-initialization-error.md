# SST Secret Initialization Error

## Table of Contents

1. [Overview](#overview)
2. [Error Details](#error-details)
3. [Environment Information](#environment-information)
4. [Root Cause](#root-cause)
5. [Solution](#solution)
6. [Best Practices](#best-practices)
7. [Related Files](#related-files)

---

## Overview

This document describes a critical error that occurs when attempting to initialize SST secrets without providing proper initialization values from environment variables.

**Error Type:** `RangeError: Invalid string length`

**Context:** SST infrastructure initialization during deployment or development startup

---

## Error Details

### Stack Trace

```
RangeError: Invalid string length
    at markNodeModules (node:internal/util/inspect:1594:21)
    at formatError (node:internal/util/inspect:1684:18)
    at formatRaw (node:internal/util/inspect:1077:14)
    at formatValue (node:internal/util/inspect:932:10)
    at Object.inspect (node:internal/util/inspect:409:10)
    at Object.defaultErrorMessage (/home/runner/work/gbfm/gbfm/.sst/platform/node_modules/@pulumi/cmd/run/error.ts:28:21)
    at process.uncaughtHandler (/home/runner/work/gbfm/gbfm/.sst/platform/node_modules/@pulumi/cmd/run/run.ts:347:3)
    at process.emit (node:events:531:35)
    at process.emit (/home/runner/work/gbfm/gbfm/.sst/platform/node_modules/source-map-support/source-map-support.js:516:21)
    at emitUnhandledRejection (node:internal/process/promises:252:13)
```

### When This Error Occurs

This error is thrown when:

1. SST attempts to initialize a `sst.Secret` with an `undefined` or invalid value
2. The environment variable referenced in the secret initialization is not set
3. The process environment is missing required configuration during infrastructure provisioning

### Affected File

`infra/secret.ts` - SST secret configuration file

---

## Environment Information

### Version Details

| Package/Tool           | Version                  |
| ---------------------- | ------------------------ |
| **SST**                | 3.17.23                  |
| **Project**            | gbfm v0.36.0             |
| **Node.js**            | (Runtime dependent)      |
| **Pulumi Provider**    | Bundled with SST 3.17.23 |
| **Source Map Support** | (Bundled with Pulumi)    |

### Infrastructure Stack

- **Framework:** SST (Serverless Stack) 3.17.23
- **IaC Engine:** Pulumi (bundled via SST)
- **Cloud Provider:** AWS (us-east-1)
- **Additional Providers:** Cloudflare DNS

---

## Root Cause

### The Problem

SST's `sst.Secret` constructor expects a valid string value (or undefined for placeholder mode). When `process.env.VARIABLE_NAME` is undefined, and no fallback is provided, Pulumi's internal error handling attempts to serialize the error state, which triggers a `RangeError` due to the invalid string length.

### Example of Problematic Code

```typescript
// infra/secret.ts
export const secret = {
  SpotifyClientId: new sst.Secret(
    'SpotifyClientId',
    process.env.SPOTIFY_CLIENT_ID // ❌ May be undefined
  ),
  DatabaseHost: new sst.Secret(
    'DatabaseHost',
    process.env.DB_HOST // ❌ May be undefined
  )
  // ... more secrets
}
```

### Why It Fails

1. **Missing Environment Variables:** If `process.env.SPOTIFY_CLIENT_ID` is not set, it evaluates to `undefined`
2. **SST Secret Validation:** SST/Pulumi attempts to process this undefined value
3. **Error Serialization Failure:** The error handling code tries to format the error message but encounters an invalid state
4. **Cascading Failure:** Instead of a helpful error message, you get `RangeError: Invalid string length`

---

## Solution

### Option 1: Ensure Environment Variables Are Set (Recommended)

**Before running SST commands**, ensure all required environment variables are set:

```bash
# Load environment variables from .env file
export $(cat .env | xargs)

# Or use a tool like dotenv
bunx dotenv-cli sst dev

# Or set variables explicitly
export SPOTIFY_CLIENT_ID="your-client-id"
export SPOTIFY_CLIENT_SECRET="your-client-secret"
export DB_HOST="your-db-host"
# ... etc

# Then run SST commands
bun dev
```

### Option 2: Use SST's Built-in Secret Management

> I want to try this one out, move from setting the values via `process.env`

Instead of passing values at initialization, set secrets using SST CLI:

```bash
# Set secrets for dev stage
sst secret set SpotifyClientId "your-value" --stage dev

# Set secrets for production stage
sst secret set SpotifyClientId "your-value" --stage prod
```

Then update `infra/secret.ts`:

```typescript
// infra/secret.ts
export const secret = {
  // Let SST manage the secret value
  SpotifyClientId: new sst.Secret('SpotifyClientId'),
  SpotifyClientSecret: new sst.Secret('SpotifyClientSecret')
  // ... etc
}
```

**Note:** This approach is preferred for production deployments as it keeps secrets out of environment variables and code.

### Option 3: Provide Fallback Values (Development Only)

For local development, you can provide fallback values:

```typescript
// infra/secret.ts
const isLocal = ['local', 'dev'].includes($app.stage)

export const secret = {
  SpotifyClientId: new sst.Secret(
    'SpotifyClientId',
    process.env.SPOTIFY_CLIENT_ID || (isLocal ? 'dev-placeholder' : undefined)
  )
  // ... etc
}
```

**⚠️ Warning:** Never use real credentials as fallback values. Only use placeholders for local development.

### Option 4: Validate Before Initialization

Add validation to fail fast with a helpful error message:

```typescript
// infra/secret.ts
function getRequiredEnv(key: string): string | undefined {
  const value = process.env[key]
  if (!value && !['local', 'dev'].includes($app.stage)) {
    console.error(`❌ Missing required environment variable: ${key}`)
    console.error(`Set it using: export ${key}="your-value"`)
    console.error(`Or use: sst secret set ${key} "your-value"`)
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

export const secret = {
  SpotifyClientId: new sst.Secret('SpotifyClientId', getRequiredEnv('SPOTIFY_CLIENT_ID'))
  // ... etc
}
```

---

## Best Practices

### 1. Use SST Secret Management for Production

**✓ DO:** Use SST's built-in secret management

```bash
sst secret set DATABASE_PASSWORD "secure-password" --stage prod
```

```typescript
export const secret = {
  DatabasePassword: new sst.Secret('DatabasePassword')
}
```

**✗ AVOID:** Passing production secrets via environment variables

### 2. Separate Dev and Prod Secret Handling

**✓ DO:** Use different strategies for different stages

```typescript
const isLocal = ['local', 'dev'].includes($app.stage)

export const secret = {
  ApiKey: new sst.Secret('ApiKey', isLocal ? process.env.API_KEY : undefined)
}
```

### 3. Document Required Environment Variables

**✓ DO:** Maintain a `.env.example` file

```bash
# .env.example
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=password
DB_PORT=5432
DB_NAME=gbfm
ACCESS_TOKEN_SECRET=your-access-token-secret
REFRESH_TOKEN_SECRET=your-refresh-token-secret
POSTHOG_KEY=your-posthog-key
POSTHOG_HOST=https://app.posthog.com
```

### 4. Fail Fast with Clear Errors

**✓ DO:** Validate early and provide actionable error messages

```typescript
if (!process.env.REQUIRED_VAR && $app.stage === 'prod') {
  throw new Error(
    'Missing REQUIRED_VAR. Set using: sst secret set REQUIRED_VAR "value" --stage prod'
  )
}
```

**✗ AVOID:** Letting undefined values propagate to Pulumi

### 5. Use CI/CD Secret Management

**✓ DO:** Set secrets in your CI/CD environment

```yaml
# GitHub Actions example
- name: Configure SST Secrets
  run: |
    sst secret set SpotifyClientId "${{ secrets.SPOTIFY_CLIENT_ID }}" --stage prod
    sst secret set DatabasePassword "${{ secrets.DB_PASSWORD }}" --stage prod
```

---

## Related Files

- `infra/secret.ts` - Secret definitions (see lines 1-28)
- `infra/vps.ts` - VPS service using secrets (see lines 47-56, 80-86)
- `sst.config.ts` - SST configuration
- `package.json` - Project dependencies and SST version

### Current Secret Configuration

As of this documentation, the following secrets are defined:

```typescript
// infra/secret.ts
export const secret = {
  SpotifyClientId,
  SpotifyClientSecret,
  AccessTokenSecret,
  RefreshTokenSecret,
  DatabaseHost,
  DatabaseUser,
  DatabasePassword,
  DatabasePort,
  DatabaseName,
  POSTHOG_KEY,
  POSTHOG_HOST
}
```

All secrets are currently initialized with `process.env.*` values, making them susceptible to this error if environment variables are not set.

---

## Additional Resources

- [SST Secrets Documentation](https://sst.dev/docs/component/secret)
- [SST Configuration Guide](https://sst.dev/docs/configuration)
- [Pulumi Error Handling](https://www.pulumi.com/docs/concepts/errors/)

---

## Changelog

| Date       | Change                | Author |
| ---------- | --------------------- | ------ |
| 2025-11-23 | Initial documentation | Claude |
