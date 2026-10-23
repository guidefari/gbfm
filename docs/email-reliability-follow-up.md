# Emails reliability follow-up

Status: proposed, docs only. Inspired by [effect-email](https://github.com/doeixd/effect-email), not a proposal to install it or replace our delivery stack.

## Decision and scope

Implement the small reliability mechanisms we need behind the existing `EmailDelivery` / `EmailTransport` boundary. Keep Cloudflare as the active provider. Borrow durable admission, explicit submission certainty, bounded dispatch, and verified event handling—not the upstream SMTP server, gateway, workflow engine, or provider catalogue.

Carry forward the prior assessment's cautions: its Effect dependency was an RC, and its SQL persistence had **unproven D1 compatibility**. Our current root manifest pins Effect `4.0.0`; the earlier RC finding is not a claim about our installed version. Workers support or a Cloudflare binding example does not prove that upstream SQL queues, migrations, transactions, and claims work on D1. Recheck versions and prove those storage semantics before any future adoption decision.

**Newsletter UI is separate work.** These mechanisms serve Emails, including newsletters and transactional messages. This follow-up does not design a newsletter editor, audience-management screens, scheduling UI, or an admin navigation change. Use Emails/newsletters terminology.

## Existing foundation versus gaps

| Area | Exists today | Still missing |
| --- | --- | --- |
| Submission | Single-recipient transport, Cloudflare adapter, typed rejection/unavailability errors, recording transport for tests | Unavailability does not distinguish definitely not submitted from possibly accepted |
| Persistence | `PENDING` log before submission; guarded terminal updates; `SENT` with provider/message ID; safe failure categories | Durable send intent and stable logical-send deduplication; logs are attempts, not a recoverable outbox |
| Recovery | Reminder claims and Queue retries; transport itself never retries or falls back | General per-recipient recovery and uncertain-outcome reconciliation; Queue retry can duplicate an accepted send after receipt persistence fails |
| Dispatch | Admin mix sends preserve one-recipient/one-log correlation with concurrency capped at five per request; Queue processes messages serially within a batch | Shared provider/account rate budgets and bounded concurrency across Workers |
| Recipient safety | User notification preferences/global unsubscribe; transactional messages bypass those preferences; Cloudflare suppression rejection is mapped | Application suppression store and verified event ingestion; schema timestamps for delivery/bounce/complaint alone do not implement this |
| Provider boundary | `EmailTransport` isolates provider calls; historical SES and Cloudflare identities in logs | Active receipt type is Cloudflare-only; no runtime multi-provider routing or capability contract |

Source of truth: [transport](../apps/server/src/services/email-transport.service.ts), [Cloudflare adapter](../apps/server/src/services/cloudflare-email.adapter.ts), [delivery service](../apps/server/src/services/email-delivery.service.ts), [log repository](../apps/server/src/repositories/email-delivery-log.repository.ts), [schema](../apps/server/src/db/email.schema.ts), [preferences](../apps/server/src/repositories/email-preferences.repository.ts), and [Worker Queue handling](../apps/server/src/worker.ts). See also the [migration's accepted duplicate-send risk](migrations/ses-to-cloudflare-email.md). The older [newsletter subscribe audit](newsletter-subscribe-audit.md) describes legacy paths, not proof of current delivery reliability.

## Priorities worth implementing ourselves

### 1. Durable per-recipient sends and explicit uncertainty

- Persist one logical send per recipient with a unique business key (for example, reminder ID + recipient, or newsletter edition ID + recipient), separately from its attempts. Snapshot rendered content or an immutable template version and inputs; define retention for that private payload.
- Commit intent before publishing work. Recover unpublished intents with an outbox publisher; use guarded claims/leases so duplicate Queue deliveries cannot start concurrent attempts. Recheck opt-out/suppression before dispatch, not only at admission.
- Separate `accepted`, `rejected`, and `uncertain` submission outcomes. Acceptance means provider acceptance, **not inbox delivery**. A timeout, invalid receipt, crash during submission, or acceptance followed by a database write failure must not become an ordinary retryable failure. Expired in-flight leases need reconciliation, not automatic resend.
- Retry only definitely unaccepted, transient failures with capped exponential backoff, jitter, and an attempt/deadline budget. Permanent rejections stop. Never automatically retry or switch providers for uncertain outcomes; reconcile through provider lookup/events where available, otherwise retain uncertainty for an explicit operator decision with duplicate-risk warning.
- Local deduplication cannot close the provider-acceptance/database-commit gap. The current Cloudflare path has no provider idempotency key; do not promise exactly-once sends.

### 2. Provider rate limits and bounded concurrency

Add configurable request and recipient budgets plus a bounded worker pool. Respect retry-after signals when available and schedule deferred attempts instead of holding a Worker open. Coordinate budgets across Worker instances using a shared authority; an in-memory limiter or serial loop per Queue batch is not an account-wide quota. Keep transactional capacity available when newsletters create a backlog. Add circuit breaking only if observed outages justify it.

### 3. Suppression and verified provider events

Persist normalized-address suppressions for hard bounces and complaints, with reason, source, and timestamps. Keep these delivery-safety restrictions distinct from optional notification preferences: a transactional preference bypass must not bypass suppression. Do not turn every soft bounce into permanent suppression.

Only ingest events through a provider-specific verifier using the raw body, signature/authentication checks, timestamp/replay bounds where supported, and size limits. Deny unverifiable events. Deduplicate event IDs, correlate by provider plus message ID, tolerate duplicate/out-of-order events, and retain unmatched verified events for later correlation. Update delivery facts and suppression idempotently without confusing acceptance with delivery. First confirm Cloudflare's available event/lookup integration; do not assume an endpoint or verifier exists.

### 4. Extend the provider seam only when needed

Preserve the existing transport rather than introducing a second email client. If a second provider is justified, generalize receipts and add explicit capabilities for idempotency, lookup, events, and provider limits. Keep retry/rate policy above adapters and logs provider-aware. Fallback is permitted only for a definitely unaccepted, safely retryable send—not as a reaction to all `EmailUnavailable` errors.

## Delivery order and proof

Start with certainty classification and durable intents/claims, then shared dispatch budgets; add suppression/event ingestion before newsletter volume grows. Generalize providers only for a concrete second-provider requirement. Prove D1 behavior on the real binding: duplicate admission and Queue delivery, concurrent claims, crash before publish, crash during submit, acceptance before receipt-write failure, and stale-lease recovery. Add deterministic tests for safe retry versus uncertainty, quota enforcement across workers, opt-out/suppression changes before send, invalid signatures, replayed events, and events arriving before receipts. Never use live recipient data in those tests.
