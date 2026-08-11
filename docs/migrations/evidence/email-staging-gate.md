# Cloudflare Email staging gate

Status: **NOT RUN**

This is the evidence sheet for M2 of
[`ses-to-cloudflare-email.md`](../ses-to-cloudflare-email.md). A human operator
must run it with the approved Cloudflare staging profile. Agents and CI must not
deploy the stack or send email.

Do not record API tokens, mailbox addresses, message bodies, subjects, auth
links, or provider message IDs in this file. Record only the safe checks below.

## Run identity

- Date:
- Operator:
- Commit:
- Alchemy stage: `email-staging`
- Worker URL recorded in the approved private operator log: [ ]
- Cloudflare account and quota approved: [ ]

## Preconditions

- [ ] `EMAIL_TEST_RECIPIENT` names the controlled mailbox.
- [ ] `ADMIN_EMAIL` is the same controlled mailbox.
- [ ] `BETTER_AUTH_URL` points at the staging Worker.
- [ ] `mail-email-staging.goosebumps.fm` is approved for the test.
- [ ] The staging secret file contains every variable listed in the migration
      spec without printing their values.
- [ ] `bun precommit` and the focused Worker/D1 suites pass at the recorded
      commit.

## Deploy

Run only from an attended shell at the repository root:

```sh
set -a
. ./.env.alchemy.staging
set +a
bunx alchemy deploy --stage email-staging --yes
```

Record safe outcomes:

- [ ] Alchemy resolves the existing `goosebumps.fm` zone.
- [ ] The sending subdomain is enabled.
- [ ] The Worker has the restricted `EMAIL` binding.
- [ ] The binding allows only the configured sender and controlled recipient.
- [ ] A repeated deployment is idempotent.

## Critical-flow matrix

Exercise product flows through the deployed Worker. Do not add a test-send HTTP
route or use a local Alchemy email binding.

| Product action | Expected template(s) | Cloudflare accepted | D1 receipt present | Mailbox received | Links work | SPF/DKIM/DMARC pass |
| --- | --- | --- | --- | --- | --- | --- |
| Register and request verification | `welcome`, `new-user-notification` | [ ] | [ ] | [ ] | [ ] | [ ] |
| Request password reset | `password-reset` | [ ] | [ ] | [ ] | [ ] | [ ] |
| Send an account invitation | `invite` | [ ] | [ ] | [ ] | [ ] | [ ] |
| Subscribe to the newsletter | `newsletter-welcome`, `newsletter-admin-notification` | [ ] | [ ] | [ ] | N/A | [ ] |
| Request an unsubscribe link | `newsletter-unsubscribe-link` | [ ] | [ ] | [ ] | [ ] | [ ] |
| Notify an eligible listener about a mix | `mix-notification` | [ ] | [ ] | [ ] | [ ] | [ ] |
| Process one due music reminder | `music-reminder` | [ ] | [ ] | [ ] | [ ] | [ ] |

Use a remote D1 query or the admin delivery-log view to check receipts. If using
SQL, return only safe fields:

```sql
SELECT
  templateName,
  status,
  provider,
  CASE WHEN providerMessageId IS NULL THEN 'missing' ELSE 'present' END AS receipt
FROM email_delivery_logs
ORDER BY createdAt DESC;
```

Every accepted row must report `status = 'SENT'`, `provider = 'cloudflare'`, and
`receipt = 'present'`. `SENT` proves provider acceptance, not final delivery;
the mailbox and header checks are separate evidence.

## Result

- Gate result: **NOT RUN**
- Failed checks:
- Follow-up issue links:
- Private evidence location:

M2 passes only when every matrix row passes. Do not start the production hard
cut on partial evidence. On failure, leave SES teardown untouched, fix forward
in staging, and repeat this sheet.
