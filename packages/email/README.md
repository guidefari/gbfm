# @gbfm/email

Provider-neutral React Email template builders for goosebumps.fm.

This package renders one recipient, subject, HTML body, plain-text body, and an
optional reply-to address. It does not read configuration, contact providers,
or send email. Applications deliver a built message through `EmailDelivery`.

## Development

```bash
bun dev
bun test
bun typecheck
```

The preview server runs at `http://localhost:2672`.

## Usage

```ts
import { buildWelcomeEmail } from '@gbfm/email/index'

const message = await Effect.runPromise(
  buildWelcomeEmail({
    to: 'listener@example.com',
    username: 'Listener',
    verificationUrl: 'https://goosebumps.fm/auth/verify-email?token=example'
  })
)
```

Pass `message` to the application `EmailDelivery` service. The delivery layer
owns the configured sender, provider submission, and delivery-log receipt.
