# Amazon SES to Cloudflare Email Sending

## Summary

Replace Amazon SES with Cloudflare Email Sending in one hard production cut.
Provision the Cloudflare sending identity and Worker binding with Alchemy, prove
one deployed non-production Worker can send, then deploy the new application and
switch production. Do not run SES and Cloudflare as selectable providers. Do not
build rollback support. If production fails after the switch, fix Cloudflare or
the adapter forward.

Improve the application design as part of the cut:

- `packages/email` renders provider-neutral messages;
- an `EmailTransport` Effect service hides the delivery provider;
- an `EmailDelivery` Effect service owns delivery-log state and calls the
  transport;
- `worker.ts` turns the raw Cloudflare binding into the application capability;
- tests use a recording transport through the same service seam.

The interface remains provider-neutral, but the only production implementation
is Cloudflare. Provider-neutral does not mean provider-selectable.

This document supersedes the email part of Phase 2 in
[`cloudflare-backend.md`](cloudflare-backend.md). It is a prerequisite for the
human API/D1 cutover in OPS-250.

## Context / Current State

### Infrastructure

`infra/email.ts` creates an `sst.aws.Email` resource for `goosebumps.fm` and uses
SST's Cloudflare DNS integration. SES authentication comes from ambient AWS
identity. `infra/dev.script.ts` links the email resource into local commands.

`alchemy.run.ts` already owns the Cloudflare Worker, D1, R2, KV, Queues, and
Durable Objects. The installed `alchemy@2.0.0-beta.64` provides:

- `Cloudflare.Email.SendingSubdomain`, which provisions a sending subdomain,
  DKIM, SPF, and return-path configuration;
- `Cloudflare.Email.SendEmail`, which adds a Worker `send_email` binding;
- `Cloudflare.Email.Send`, which wraps that binding for Effect code.

### Rendering and delivery

`packages/email/src/sender.ts` renders React Email components and calls
`sendTemplate` from `packages/email/src/ses.ts`.

`ses.ts` combines:

- SST `Resource.Email` lookup;
- a module-level `SESv2Client`;
- sender-address construction;
- HTML-to-text conversion;
- hand-written MIME construction;
- attachment encoding;
- SES delivery.

This makes the template package depend on one provider and one infrastructure
tool. It also prevents the Worker composition root from supplying a request-local
Cloudflare binding.

No application caller supplies attachments. Every current flow sends one message
to one recipient. The admin mix-notification handler loops over recipients and
sends each message separately.

### Callers

| Flow | Caller | Current helper |
| --- | --- | --- |
| Email verification | `apps/server/src/lib/auth.ts` | `sendWelcomeEmail` |
| Password reset | `apps/server/src/lib/auth.ts` | `sendPasswordResetEmail` |
| New-user admin notice | `apps/server/src/lib/auth.ts` | `sendNewUserNotificationEmail` |
| Invitation | `apps/server/src/http/invite.handlers.ts` | `sendInviteEmail` |
| Newsletter welcome | `apps/server/src/http/newsletter.handlers.ts` | `sendNewsletterWelcomeEmail` |
| Newsletter unsubscribe | `apps/server/src/http/newsletter.handlers.ts` | `sendNewsletterUnsubscribeLinkEmail` |
| Newsletter admin notice | `apps/server/src/http/newsletter.handlers.ts` | `sendNewsletterAdminNotificationEmail` |
| Mix notification | `apps/server/src/http/email.handlers.ts` | `sendMixNotificationEmail` |
| Music reminder | `apps/server/src/services/email.service.ts` | `sendMusicReminderEmail` |
| Development test | `packages/email/src/test-send.ts` | `sendTestEmail` |

Most callers import provider-backed package functions directly. The existing
`EmailService` covers only reminders.

### Delivery logs

`email_delivery_logs` contains `PENDING`, `SENT`, `DELIVERED`, `BOUNCED`,
`COMPLAINED`, and `FAILED`, plus a nullable `sesMessageId`.

Current helpers return `void`, so most sends cannot save the SES message ID. No
inbound SES lifecycle handler was found. In practice, the application records
provider acceptance as `SENT` and synchronous rejection as `FAILED`.

This migration preserves that level of behavior. Cloudflare lifecycle-event
subscriptions are useful, but they are not required to replace the behavior the
application has today. They can be added after the cut as a separate feature.

## Problem

The Worker cannot use the current email package cleanly:

1. Delivery depends on ambient AWS credentials and a module-level SES client.
2. Sender configuration depends on SST's global `Resource` module.
3. Product workflows import provider-backed functions directly.
4. Delivery records expose an SES-specific message-ID field.
5. The Worker bundle retains the SES SDK and an AWS runtime dependency.
6. Several callers own rejected promises poorly, including a detached password
   reset send.

The migration should remove those problems without building a general provider
framework or a gradual provider rollout.

## Users / Callers

Better Auth callbacks, Effect HTTP handlers, and the reminder Queue consumer call
email delivery. End users rely on verification, password-reset, invitation,
newsletter, mix-notification, and reminder messages. Operators rely on the admin
delivery log and Cloudflare's Email Sending dashboard.

## Goals

- Replace SES with Cloudflare Email Sending in one production switch.
- Provision the Cloudflare sending identity and Worker binding with Alchemy.
- Remove SES, its AWS SDK, SST email links, and ambient AWS credentials.
- Keep React Email templates provider-free.
- Give all callers one provider-neutral `EmailDelivery` capability.
- Keep raw Cloudflare bindings at the Worker composition seam.
- Persist Cloudflare's returned `messageId` for accepted sends.
- Own every send Promise or Effect; no detached delivery.
- Preserve template content, product rules, and public HTTP behavior.
- Use typed Effect failures for render, persistence, and provider errors.
- Use a recording transport for tests instead of module mocks.

## Non-Goals

- A gradual rollout, percentage switch, feature flag, or provider selection.
- Runtime SES fallback or DNS rollback support.
- Dual-send, dual-write, or reconciliation between providers.
- A production SES implementation of the new `EmailTransport` interface.
- Cloudflare Email Sending lifecycle-event subscriptions, event Queue, or DLQ.
- Application-level delivery, bounce, or complaint state beyond current
  synchronous behavior.
- Bulk campaigns or batching up to Cloudflare's 50-recipient limit.
- Attachment support. There is no current caller; add it when a product flow
  needs it.
- Changing email template design or copy.
- Migrating unrelated DNS, static-site, R2, or redirect resources from SST.
- Keeping the old admin `sesMessageId` contract for compatibility if repository
  consumer audit confirms it is unused.

## Invariants

- One application delivery targets exactly one recipient.
- One application action makes at most one provider call.
- The application never sends the same message through SES and Cloudflare.
- Verification and password-reset links preserve their current values.
- Sender display name remains `goosebumps.fm`.
- A successful transport result includes a non-empty provider message ID.
- `SENT` means Cloudflare accepted the message, not that the recipient server
  delivered it.
- A caller reports send success only after the delivery log stores the receipt.
- Message bodies, subjects, recipients, links, and tokens never enter errors,
  logs, traces, or metric labels.
- No raw Cloudflare binding type appears in a Domain Module or Service Module
  interface.
- Local development cannot send real email by default.

## Design Constraints

### Hard cut does not remove prerequisite checks

No rollback means the pre-cut gate must be strong. Before production deployment:

- Cloudflare Email Sending must be enabled for the account;
- the sending identity must be enabled and authenticated;
- the account quota must exceed measured production use;
- every critical template must send from the deployed staging Worker;
- the production Worker must have the binding before traffic reaches it.

These are deployment prerequisites, not a gradual migration.

### Cloudflare limits

Cloudflare's structured Worker API currently limits one message to:

- 50 addresses across `To`, `Cc`, and `Bcc`;
- 32 attachments;
- 5 MiB total message size by default;
- 25 MiB only when all destinations are verified.

The chosen application contract allows one recipient and no attachments. This
makes the provider limits irrelevant to current product behavior and removes the
hand-written MIME path.

### Worker-only binding

The `send_email` binding exists only in Workers. The hard cut therefore happens
with the Worker/API deployment. Do not add REST or SMTP credentials so ECS can
call Cloudflare first.

### Sending identity

Milestone 0 must prove whether the account can send from the zone apex or needs a
subdomain such as `mail.goosebumps.fm`.

If Cloudflare requires a subdomain, use:

```text
From: goosebumps.fm <noreply@mail.goosebumps.fm>
```

Preserve explicit `Reply-To` values. Do not claim to send from an unverified root
address.

### No provider retry machinery

Make one provider call. Map documented Cloudflare errors into typed failures and
return them to the owning workflow. Do not add transport retries, fallback, or
unknown-outcome reconciliation in this migration. Cloudflare owns downstream
SMTP retry after accepting a message.

### Provider-neutral is not provider-pluggable

The interface hides a true external boundary and supports a recording test
implementation. Do not add provider registries, factories, configuration enums,
or dormant SES/Resend adapters. A future provider replacement can implement the
same small interface when needed.

## Alternatives Considered

### Gradual SES/Cloudflare selection

A provider flag, two live adapters, dual schema support, soak routing, and
rollback path increase code and operations. The user has chosen a hard cut and
fix-forward policy. Rejected.

### Cloudflare REST or SMTP

Both let ECS send through Cloudflare before the Worker cut, but add credentials,
protocol code, and an intermediate state with no lasting value. Rejected.

### Direct package access to the Worker binding

Bindings arrive through Worker `env`. Hiding one in module state would break the
composition boundary and request isolation. Rejected.

### Keep send helpers and replace only `ses.ts`

This removes AWS but leaves hidden delivery dependencies, rejected promises, and
repeated delivery-log logic across callers. Rejected.

### Build delivery-event subscriptions now

The current SES implementation does not consume delivery events. Building an
Alchemy custom event-subscription resource, Queue parser, idempotency table, DLQ,
and state machine would widen a provider replacement into a new observability
feature. Defer it.

### Use Resend

Resend remains an option if the Cloudflare account gate fails. It is not part of
the selected design.

## Recommendation

Use two small Effect modules:

1. `EmailTransport`, an External Adapter Module interface that sends one rendered
   message and returns a provider-neutral receipt.
2. `EmailDelivery`, a Service Module that creates the delivery log, calls the
   transport, and records `SENT` or `FAILED`.

`packages/email` only builds rendered messages. `worker.ts` creates the
Cloudflare transport from `env.EMAIL`. Tests provide a recording transport. No
production provider selection exists.

## Proposed Design

### Architecture

```diagram
Product workflow
      │
      ▼
packages/email template builder
      │ RenderedEmail
      ▼
EmailDelivery service
      ├── create PENDING log
      │
      ▼
EmailTransport service
      │
      ▼
Cloudflare adapter created by worker.ts
      │
      ▼
env.EMAIL.send
      │ SendReceipt(messageId)
      ▼
EmailDelivery stores SENT + providerMessageId
```

### Provider-neutral message

`packages/email` exports a narrow rendered-message type:

```ts
export interface RenderedEmail {
  readonly to: EmailAddress
  readonly subject: string
  readonly html: string
  readonly text: string
  readonly replyTo?: EmailAddress
}
```

Templates do not choose the sender. `EmailDelivery` reads one configured sender
identity and adds the full parsed address and display name before calling the
transport:

```ts
export interface OutboundEmailMessage extends RenderedEmail {
  readonly from: EmailAddress
  readonly fromName: string
}
```

There is no recipient array and no attachment field. Those are not current
requirements.

Template builders return `Effect.Effect<RenderedEmail, EmailRenderError>`:

```ts
const message = yield* buildPasswordResetEmail({
  to: user.email,
  resetUrl: url,
  expiresIn: '1 hour'
})
```

The existing React Email renderer and React DOM fallback may stay, but a double
failure becomes a typed `EmailRenderError` with no message content.

### EmailTransport

```ts
export interface EmailTransportService {
  readonly send: (
    message: OutboundEmailMessage
  ) => Effect.Effect<SendReceipt, EmailRejected | EmailUnavailable>
}

export const EmailTransport =
  Context.Service<EmailTransportService>('EmailTransport')

export interface SendReceipt {
  readonly provider: 'cloudflare'
  readonly messageId: string
  readonly acceptedAt: Date
}
```

The interface is provider-neutral in behavior even though the current receipt
records the concrete provider for persistence and operations. A future adapter
can widen the provider value deliberately.

`EmailDelivery` resolves the sender once from parsed application configuration.
The transport receives a complete address; it does not join local parts and
domains or read environment variables.

The service hides:

- Cloudflare builder translation;
- provider error classification;
- safe transport telemetry;
- receipt projection.

### Typed provider failures

```ts
export class EmailRejected extends Data.TaggedError('EmailRejected')<{
  readonly reason:
    | 'invalid-message'
    | 'sender-not-verified'
    | 'recipient-not-allowed'
    | 'recipient-suppressed'
    | 'content-too-large'
  readonly providerCode?: string
}> {}

export class EmailUnavailable extends Data.TaggedError('EmailUnavailable')<{
  readonly providerCode?: string
  readonly cause: unknown
}> {}
```

Map Cloudflare errors as follows:

| Cloudflare code | Local failure |
| --- | --- |
| `E_VALIDATION_ERROR`, `E_FIELD_MISSING`, `E_TOO_MANY_RECIPIENTS`, `E_TOO_MANY_ATTACHMENTS` | `EmailRejected('invalid-message')` |
| `E_CONTENT_TOO_LARGE` | `EmailRejected('content-too-large')` |
| `E_SENDER_NOT_VERIFIED`, `E_SENDER_DOMAIN_NOT_AVAILABLE` | `EmailRejected('sender-not-verified')` |
| `E_RECIPIENT_NOT_ALLOWED` | `EmailRejected('recipient-not-allowed')` |
| `E_RECIPIENT_SUPPRESSED` | `EmailRejected('recipient-suppressed')` |
| `E_DELIVERY_FAILED` | `EmailRejected('recipient-not-allowed')` until a better product category is needed |
| rate, daily quota, internal, or unknown failures | `EmailUnavailable` |

The adapter retains `cause: unknown` but never includes raw provider messages in
user responses or broad telemetry.

### EmailDelivery

`EmailDelivery` owns the repeated application workflow:

```ts
export interface DeliveryRequest {
  readonly message: RenderedEmail
  readonly emailType: EmailNotificationType
  readonly templateName: EmailTemplateName
  readonly userId?: string
  readonly recipientName?: string
  readonly safeMetadata?: EmailDeliveryMetadata
}

export interface EmailDeliveryService {
  readonly deliver: (
    request: DeliveryRequest
  ) => Effect.Effect<SendReceipt, EmailRenderError | EmailDeliveryError>
}
```

The implementation:

1. inserts a `PENDING` delivery log;
2. yields `EmailTransport`;
3. sends once;
4. updates the row to `SENT` with provider, provider message ID, and `sentAt`;
5. returns the receipt;
6. on typed send failure, updates the row to `FAILED` with a safe category and
   returns a typed `EmailDeliveryError`.

This removes repeated log transitions from auth, reminders, and HTTP handlers.
The service owns persistence through the existing `Database` Effect service.

`safeMetadata` must use a closed schema. Do not accept `Record<string, unknown>`
or copy arbitrary request payloads into logs.

### Template package boundary

`packages/email` owns:

- React Email components;
- template input types;
- subject selection;
- HTML and text rendering;
- provider-neutral message construction.

It does not own:

- provider SDKs or bindings;
- SST or Alchemy resources;
- environment lookup;
- database writes;
- retries;
- delivery telemetry.

Rename send-shaped helpers to build-shaped helpers, such as:

- `sendWelcomeEmail` -> `buildWelcomeEmail`;
- `sendPasswordResetEmail` -> `buildPasswordResetEmail`;
- `sendMusicReminderEmail` -> `buildMusicReminderEmail`.

The names should tell callers that building does not perform I/O.

### Cloudflare adapter and composition

`alchemy.run.ts` adds the sending identity and binding:

```ts
const sendingDomain = yield* Cloudflare.Email.SendingSubdomain('EmailSending', {
  zoneId,
  name: sendingDomainName
})

const email = yield* Cloudflare.Email.SendEmail('EMAIL', {
  allowedSenderAddresses
})
```

Bind `EMAIL` to the API Worker.

Resolve the existing Cloudflare zone. Do not create, duplicate, or adopt the
whole zone. The sending resource may create its required authentication records.
Do not also declare them in SST or Wrangler.

`worker.ts` is the raw binding seam:

```ts
export type ApiEnv = WorkerConfigBindings & {
  readonly EMAIL: SendEmail
  // existing bindings
}
```

It builds an `EmailTransport` Layer that closes over `env.EMAIL`. Inner services
see `EmailTransport`, never `SendEmail`, `EmailMessage`, or `Env`.

Use Cloudflare's structured API:

```ts
const result = await binding.send({
  from: { email: sender, name: 'goosebumps.fm' },
  to: message.to,
  subject: message.subject,
  html: message.html,
  text: message.text,
  replyTo: message.replyTo
})
```

Do not port the raw SES MIME builder.

### Better Auth integration

`makeAuth` must receive or close over the Effect runtime that provides
`EmailDelivery`. Better Auth callbacks remain Promise boundaries, but each runs
one owned Effect.

Password reset currently starts a Promise without awaiting it. Change the
callback to await delivery. Better Auth must not report callback completion while
the provider call is still detached.

Verification, reset, and new-user notification use the same `EmailDelivery`
service as HTTP and Queue workflows.

### HTTP and reminder callers

Each caller becomes:

```ts
const message = yield* buildInviteEmail(input)
const delivery = yield* EmailDelivery
yield* delivery.deliver({
  message,
  emailType: EMAIL_NOTIFICATION_TYPES.TRANSACTIONAL,
  templateName: 'invite',
  userId
})
```

HTTP handlers translate typed delivery failures at their current boundary. They
do not catch arbitrary provider exceptions.

The admin mix loop remains one delivery per eligible recipient. This preserves
preference checks, privacy, and one-row/one-message correlation.

The reminder Queue marks its claim complete only after `EmailDelivery` returns a
receipt. A failed delivery follows the existing failed reminder path. No provider
fallback occurs.

### Persistence

Replace `sesMessageId` with:

```ts
provider: text({ enum: ['ses', 'cloudflare'] })
providerMessageId: text()
```

The provider field preserves historical meaning. It is not a runtime provider
selector.

Since this is a hard cut:

- change the D1 schema directly;
- update `migrate-pg-to-d1.ts` to map historical non-null `sesMessageId` to
  `provider = 'ses'` and `providerMessageId`;
- write new rows with `provider = 'cloudflare'`;
- remove `sesMessageId` from the D1 target rather than keeping a compatibility
  column;
- do not add a Postgres compatibility migration for future writes;
- do not support old ECS writes after cutover.

For the deployed staging D1 database, add a normal D1 migration that creates the
neutral fields, copies historical values, and removes or ignores the old field
according to SQLite migration constraints.

Audit `apps/www`, mobile, and admin consumers before removing `sesMessageId` from
the API schema. Repository search currently shows only the API contract and its
tests, not an application consumer. If confirmed, replace it outright with:

```ts
provider: Schema.NullOr(Schema.Literals(['ses', 'cloudflare']))
providerMessageId: Schema.NullOr(Schema.String)
```

No deprecation window is required under the chosen hard-cut policy.

### Delivery status

Keep existing statuses for historical data and admin totals. For new Cloudflare
sends in this migration:

```text
PENDING -> SENT
PENDING -> FAILED
```

`SENT` means the Cloudflare API accepted the message and returned a message ID.
Cloudflare's dashboard and analytics own final delivery investigation.

A later spec may add event subscriptions and move rows to `DELIVERED`, `BOUNCED`,
or `COMPLAINED`. Do not imply that this migration provides those transitions.

### Local development

Default local development uses a recording `EmailTransport` Layer. It captures
rendered messages for assertions and may write `.eml` previews to an ignored
directory. It never sends real email.

Move `packages/email/src/test-send.ts` to application-level tooling or delete it.
A template package should not own production provider access.

A remote staging smoke command may send to one explicit test address through the
deployed Worker. It must not accept an arbitrary production destination by
default.

### Observability

Record safe spans and counters for:

- template name or closed email type;
- `accepted`, `rejected`, or `unavailable`;
- provider code from the documented finite set;
- render failure;
- delivery-log persistence failure.

Do not record recipient, subject, message ID, body, URL, token, or raw provider
error text in broad logs or metric labels. The provider message ID belongs in the
restricted delivery-log row.

Use Cloudflare's Email Sending dashboard and GraphQL analytics for delivery,
bounce, complaint, and suppression operations after the cut.

## Call Stacks and Data Flow

### Auth email

```text
Better Auth callback
  -> build template
  -> EmailDelivery.deliver
  -> insert PENDING
  -> EmailTransport.send
  -> Cloudflare binding
  -> store SENT + messageId
  -> callback resolves
```

### Reminder email

```text
Reminder Queue consumer
  -> claim reminder
  -> build template
  -> EmailDelivery.deliver
  -> Cloudflare binding
  -> store receipt
  -> complete reminder claim
```

### Production hard cut

```text
Alchemy creates and verifies sending identity + binding
  -> deploy Worker code with Cloudflare adapter
  -> run controlled staging sends
  -> run production deployment / DNS cut
  -> run one controlled production smoke send
  -> monitor and fix forward
  -> delete SES infrastructure and credentials
```

There is no runtime branch back to SES.

## Seams, Boundaries, Adapters, and Implementations

| Concern | Module kind | Boundary |
| --- | --- | --- |
| Email address parsing | Domain Module | string to refined value |
| React Email rendering | External Adapter Module | component to HTML/text |
| Delivery log + send workflow | Service Module | product request to persisted receipt |
| `EmailTransport` | External Adapter Module interface | rendered message to accepted receipt |
| Cloudflare adapter | External Adapter Module implementation | app types to Worker binding |
| Recording transport | Test implementation | app types to captured records |
| `worker.ts` | Cloudflare composition seam | raw binding to Effect Layer |
| `alchemy.run.ts` | Infrastructure composition | sending identity and Worker binding |

The interface is justified by one true external provider boundary and one test
implementation. Do not create more interfaces per template or caller.

## Types, Interfaces, and APIs

### Public HTTP API

No product endpoint changes. The admin email-log response replaces
`sesMessageId` with `provider` and `providerMessageId` after the repository
consumer audit.

### Internal template API

Builders return `Effect.Effect<RenderedEmail, EmailRenderError>` and do no I/O
beyond rendering.

### Internal service API

Product workflows use `EmailDelivery`. Only `EmailDelivery` uses
`EmailTransport`. This keeps provider mechanics and persistence ordering out of
callers.

## Files to Add / Change / Delete

| Path | Action | Purpose |
| --- | --- | --- |
| `docs/migrations/ses-to-cloudflare-email.md` | add | this specification |
| `packages/email/src/message.ts` | add | parsed provider-neutral message types |
| `packages/email/src/render.ts` | add/change | typed React Email rendering |
| `packages/email/src/sender.ts` | replace/rename | build helpers without delivery I/O |
| `packages/email/src/ses.ts` | delete | remove SES and MIME implementation |
| `packages/email/src/index.ts` | change | export provider-free builders |
| `packages/email/src/test-send.ts` | delete/move | provider smoke belongs to app tooling |
| `packages/email/package.json` | change | remove AWS SDK and SST |
| `packages/email/README.md` | change | describe template build and preview |
| `apps/server/src/services/email-transport.service.ts` | add | transport interface and failures |
| `apps/server/src/services/cloudflare-email.adapter.ts` | add | Cloudflare translation |
| `apps/server/src/services/email-delivery.service.ts` | add | log/send/update workflow |
| `apps/server/src/services/email.service.ts` | delete/merge | replace reminder-only email wrapper |
| `apps/server/src/db/email.schema.ts` | change | provider-neutral receipt fields |
| `apps/server/drizzle-d1/*` | add migration | staging/current D1 transition |
| `apps/server/scripts/migrate-pg-to-d1.ts` | change | historical SES-field transform |
| `apps/server/scripts/verify-pg-to-d1.ts` | change | verify transformed receipt fields |
| `apps/server/src/repositories/email-delivery-log.repository.ts` | change | neutral receipt operations |
| `apps/server/src/lib/auth.ts` | change | owned `EmailDelivery` effects |
| `apps/server/src/http/invite.handlers.ts` | change | use `EmailDelivery` |
| `apps/server/src/http/newsletter.handlers.ts` | change | use `EmailDelivery` |
| `apps/server/src/http/email.handlers.ts` | change | use `EmailDelivery` |
| `apps/server/src/services/reminder-processor.ts` | change | use `EmailDelivery` |
| `apps/server/src/worker.ts` | change | bind email and compose transport Layer |
| `apps/server/src/runtime/services.ts` | change | include delivery services |
| `packages/api/src/email.ts` | change | neutral admin receipt fields |
| `alchemy.run.ts` | change | sending identity and binding |
| `infra/email.ts` | delete | remove SES identity |
| `infra/dev.script.ts` | change | remove email links |
| `sst.config.ts` | change | stop loading SES infrastructure |

## RGR TDD Test Plan

### Slice 1 — Provider-free templates

- Build every template through its public builder.
- Assert recipient, subject, reply-to, non-empty HTML/text, and stable auth
  links.
- Assert `EmailDelivery` adds the configured full sender address before calling
  the recording transport.
- Force rendering failure through a real rendering seam and assert
  `EmailRenderError`.
- Source guard: no `@aws-sdk`, `sst`, SES, or Cloudflare binding import remains
  in `packages/email`.

### Slice 2 — EmailTransport seam

- Provide a recording transport through the real Effect Layer.
- Assert one delivery records one message and one recipient.
- Assert the recording receipt reaches the caller.
- Assert typed rejection and unavailable failures remain distinct.
- Do not use module mocks or method spies.

### Slice 3 — EmailDelivery workflow

Against real local D1 migrations and the recording transport:

- insert `PENDING` before send;
- acceptance stores `SENT`, `cloudflare`, message ID, and `sentAt`;
- typed transport failure stores `FAILED` with a safe category;
- persistence failure stays distinct from provider failure;
- no content or recipient leaks into captured logs;
- each caller uses the same service behavior.

### Slice 4 — Cloudflare adapter

Supply a fake binding at the Worker composition seam:

- structured HTML, text, sender, recipient, subject, and reply-to reach the
  binding;
- successful response becomes a neutral receipt;
- every documented error code maps to the expected tagged failure;
- unknown thrown values become `EmailUnavailable`;
- telemetry includes only safe finite fields.

### Slice 5 — Better Auth and caller ownership

- password reset awaits delivery;
- verification awaits delivery and stores a receipt;
- invite/newsletter/admin/reminder paths use `EmailDelivery`;
- preference skips do not call the transport;
- admin mix notifications remain one call per eligible recipient;
- reminder completion follows receipt persistence.

### Slice 6 — Data transformation

Using the production-shaped migration fixture:

- historical `sesMessageId` becomes `provider = 'ses'` plus
  `providerMessageId`;
- null historical IDs remain null;
- new rows use `provider = 'cloudflare'`;
- verification checks counts and transformed values;
- the D1 target contains no required `sesMessageId` compatibility path;
- the admin API returns only the approved neutral shape.

### Slice 7 — Alchemy and deployed Worker

In a non-production stage:

- Alchemy resolves the existing zone;
- the sending identity becomes enabled;
- DKIM, SPF, and return-path setup validates;
- the Worker receives the `EMAIL` binding;
- sender restrictions match the stage;
- repeated deploy is idempotent;
- the deployed Worker sends each critical template to a controlled mailbox;
- received headers pass SPF, DKIM, and DMARC;
- auth links work;
- Cloudflare message IDs match D1 delivery logs.

### Slice 8 — Hard production cut

Human-run:

- deploy infrastructure and Worker;
- confirm the production sending identity is enabled;
- switch production API traffic;
- send one controlled production smoke message;
- exercise verification, reset, and one reminder flow;
- inspect Cloudflare acceptance and delivery dashboards;
- fix forward on failure;
- remove SES resources and credentials after the smoke gate.

All ordinary tests run under `bun precommit`. Real Cloudflare sends are explicit
credentialed evidence and do not run in CI.

## Milestones

### M0 — Hard gate

- measure current SES daily and peak send volume;
- confirm no attachment caller;
- confirm Cloudflare Email Sending account access and quota;
- prove root domain versus sending subdomain;
- list exact production sender addresses;
- audit `sesMessageId` API consumers.

**Gate:** Cloudflare can send from the chosen identity at required volume. If it
cannot, stop and choose another provider. This is not a runtime fallback.

### M1 — Design cut

- make `packages/email` provider-free;
- add `EmailTransport`, recording transport, and `EmailDelivery`;
- migrate every caller;
- transform schema and migration tooling;
- delete SES application code and dependencies.

**Gate:** all caller tests pass through the recording transport, D1 migration
verification passes, and the Worker graph has no SES dependency.

### M2 — Cloudflare infrastructure and staging proof

- add the Alchemy sending identity and binding;
- implement the Cloudflare adapter;
- deploy a non-production Worker;
- send all critical templates to controlled addresses;
- verify authentication headers and links.

**Gate:** every critical flow gets a Cloudflare message ID and passes received
mail checks. Do not cut production on partial evidence.

### M3 — Production hard cut

- deploy the production Worker and binding;
- switch API traffic;
- run the controlled smoke flows;
- monitor Cloudflare and application errors;
- fix forward if any check fails;
- delete SES infrastructure, IAM access, SST email links, and remaining AWS email
  configuration.

**Gate:** Cloudflare accepts the smoke messages, critical links work, reminder
flow completes once, and no SES dependency remains.

## Acceptance Gates

The migration is complete when:

- every application caller uses `EmailDelivery`;
- `packages/email` contains no provider or infrastructure dependency;
- `worker.ts` is the only raw email-binding composition seam;
- Alchemy owns the sending identity and Worker binding;
- SPF, DKIM, and DMARC pass for the production identity;
- every critical template sends through the deployed Worker;
- every accepted send records a Cloudflare message ID;
- all send work is owned and awaited;
- D1 historical records use provider-neutral receipt fields;
- the application and deployed Worker contain no SES SDK or AWS email call;
- SES identity, IAM access, SST email resource, and email links are deleted;
- `bun precommit` and the focused Worker/D1 suites pass.

## Risks and Open Questions

| Risk / question | Impact | Response |
| --- | --- | --- |
| Cloudflare Email Sending is unavailable or under-quota. | Hard blocker. | M0 gate; choose another provider rather than build fallback. |
| Root-domain sending is not supported by the Alchemy resource. | Visible sender-domain change. | Prove and approve `mail.goosebumps.fm` before implementation. |
| Cloudflare delivery differs from SES. | Messages may land in spam or fail. | Staging mailbox checks and production smoke; fix forward. |
| No runtime rollback exists. | Production email can fail until repaired. | Strong pre-cut gate, narrow adapter, controlled smoke, clear operator access. |
| Provider acceptance is not final delivery. | Admin `SENT` can overstate outcome. | Define `SENT` as accepted; use Cloudflare dashboard. Add events later if needed. |
| Removing `sesMessageId` breaks an unknown client. | Admin API break. | Complete repository and known-client audit in M0. |
| Existing direct callers hide detached work. | False success or lost failures. | Move every caller to owned `EmailDelivery` effects. |
| A future provider needs attachments. | Interface must grow. | Add only with a real caller and tests; do not preserve dead SES MIME code. |
| SES deletion happens before all smoke checks finish. | No quick external fallback. | Order teardown after the production smoke even under fix-forward policy. |

Human decisions required before M1:

1. Send from `goosebumps.fm` or `mail.goosebumps.fm`?
2. Which sender local parts should production allow?
3. What production smoke checks must pass before deleting SES?

## References

- Parent plan: [`cloudflare-backend.md`](cloudflare-backend.md)
- Worker/D1 migration: [`postgres-to-d1.md`](postgres-to-d1.md)
- Current SES adapter: `packages/email/src/ses.ts`
- Current template sender: `packages/email/src/sender.ts`
- Current SST email resource: `infra/email.ts`
- Current Alchemy stack: `alchemy.run.ts`
- [Cloudflare Email Sending Workers API](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/)
- [Cloudflare send bindings](https://developers.cloudflare.com/email-service/configuration/send-bindings/)
- [Cloudflare Email Service limits](https://developers.cloudflare.com/email-service/platform/limits/)
- [Cloudflare Email Service metrics](https://developers.cloudflare.com/email-service/observability/metrics-analytics/)
- [Alchemy `SendingSubdomain`](https://alchemy.run/providers/cloudflare/email/sendingsubdomain/)
