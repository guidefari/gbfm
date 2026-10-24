# Incident retro: unreadable Alchemy deployment state

**Status:** GBFM production deployment restored on 2026-10-24. Prevention work remains open.

**Scope:** Alchemy state for `gbfm/prod` in Cloudflare.

**Recovered release:** `2.107.0`, commit [`588a9286`](https://github.com/guidefari/gbfm/commit/588a92864d38093a9e509405448cf138eabd868d).

## Summary

Production deployments failed because the state-store encryption key could no longer decode GBFM's saved infrastructure state. Cloudflare still had the resources and the encrypted records, but Alchemy could not read those records to plan a deployment.

The encryption-key secret's last modification was on October 13, shortly before a state-store Worker deployment. We confirmed that the current key could decode the state store's own bootstrap records but none of GBFM's 58 encrypted records. We did not establish which command or process changed the key.

No usable backup of the previous key was available. We reconstructed production state from the existing Cloudflare resources, verified a plan with no deletions or replacements, and saved the reconstructed records under the current key. The same previously failing CI run then deployed successfully.

## Impact

- The first observed deployment failure was October 15. Recovery completed on October 24, about nine days later.
- The last successful deployment before the incident was October 10. Subsequent releases could not reach production through this workflow until recovery.
- The failing runs stopped during planning, before applying application changes.
- The production API and website returned HTTP 200 during recovery. We have no evidence of a serving outage caused by this incident, but did not establish availability for the entire incident window.
- State-read checks also failed for old GBFM development records. The recovery covered `gbfm/prod` only. It does not establish that other stages or projects using the shared state store are healthy.

## Where the state and credentials live

```text
GitHub Actions
  Cloudflare API token from repository secrets
    |
    v
Alchemy CLI
  Authenticates requests to the remote state store
    |
    v
Cloudflare Worker: alchemy-state-store
  |
  +-- Cloudflare Secrets Store
  |     AlchemyStateStoreToken: request authentication
  |     AlchemyStateStoreEncryptionKey: state encryption/decryption
  |
  +-- Durable Object namespace: alchemy-state-store_Store
        Object: gbfm
          Stage: prod
            33 encrypted resource records and stack output
```

The Cloudflare API token, state-store authentication token, and encryption key have separate jobs. Replacing an access token changes who can make requests. Replacing the encryption key without migrating records makes existing state unreadable.

The state-store Worker reads the encryption key through a Cloudflare secret binding. CI does not need that key in GitHub. Successful deployments save updated state back to the Durable Object, encrypted with the same key.

Local development uses a separate file-backed store through [`alchemy/state.ts`](../../alchemy/state.ts). It does not repair or validate the production store.

## Timeline

All times below are UTC. Cloudflare timestamps identify observed changes, not who initiated them.

| Time | Evidence |
| --- | --- |
| October 10 | [Last successful deployment before the failure](https://github.com/guidefari/gbfm/actions/runs/38064646035). |
| October 13, 12:53:46 | Cloudflare records modifications to both `AlchemyStateStoreEncryptionKey` and `AlchemyStateStoreToken`. |
| October 13, 12:54:01 | Cloudflare records a state-store Worker deployment. |
| October 15, 11:22 | [Deployment fails while loading state](https://github.com/guidefari/gbfm/actions/runs/38726801849), using Alchemy `2.0.0-beta.81`. |
| October 15 | [`96a08b2b`](https://github.com/guidefari/gbfm/commit/96a08b2b41eb73037414bc3e835491f73e0300d5) isolates local dev state. Its README explicitly says local startup does not repair unreadable deployment state. |
| October 15, 11:43 to 11:50 | Cloudflare records three further state-store Worker deployments. Later CI failures show that they did not resolve the blocker. |
| October 23 | [Deployment fails with the same error](https://github.com/guidefari/gbfm/actions/runs/40023925656), now using Alchemy `2.0.0-beta.83`. |
| October 24, 06:14 | [Attempt 1 of run 40069327660 fails](https://github.com/guidefari/gbfm/actions/runs/40069327660/attempts/1). |
| October 24, recovery session | Direct reads, a protected ciphertext export, and offline decoding isolate the key mismatch. The owner approves state reconstruction and deployment. |
| October 24, 15:04:02 | Attempt 2 completes deployment: 17 operations succeeded. |
| October 24, 15:04:11 | All workflow traffic checks pass. The job completes at 15:04:28. |
| October 24, after recovery | All 33 production state records read successfully. The current encryption key is saved and verified in 1Password. |

## Diagnosis and cause

The CI error was:

```text
Refreshing Cloudflare State Store credentials: success
Planning failed
StateStoreError: State store request failed (DecodeError, HTTP 500).
```

That message identified the failing service but did not establish whether the fault was authentication, runtime code, or stored data. `DecodeError` described the client failing to decode the HTTP error response.

We narrowed the failure through read-only checks:

| Check | Result |
| --- | --- |
| State-store `/version` | HTTP 200, expected Cloudflare state-store version `7` |
| Unauthenticated state request | HTTP 401 |
| List stacks, stages, and resource names | Successful |
| Read production resource records | 33 of 33 returned HTTP 500 |
| Read old development resource records | 15 of 15 returned HTTP 500 |
| Read bootstrap infrastructure records | 6 of 6 returned HTTP 200 |
| Decode exported GBFM ciphertext with the current key | 0 of 58 records decoded |
| Decode exported bootstrap ciphertext with the same key | 6 of 6 records decoded |

The 58-record export covers the GBFM object's stored entries across stages, not 58 production resources. Production had 33 resource records plus its stack output.

The installed and deployed state-store code used AES-CTR. This mode does not authenticate ciphertext: decrypting with the wrong key can return bytes without a cryptographic error. Parsing those bytes as text or JSON then fails. The offline check reproduced that pattern for every GBFM record while successfully decoding the bootstrap records.

**Confirmed cause:** GBFM's existing ciphertext was incompatible with the current state-store encryption key.

**Unresolved trigger:** the exact operation that changed the key. The October 13 secret modification and Worker deployment are strong temporal evidence, but do not prove that a particular Alchemy command, upgrade, or person caused it. The failure already existed on beta.81, so the later beta.83 upgrade was not its initial trigger.

## Why this was hard to diagnose

- `/version` passed even though resource reads failed. Service reachability was not a state-integrity check.
- Credential refresh succeeded, which did not establish that encrypted records were readable.
- Historical Worker logs were unavailable with the investigation token's permissions. Live tail access worked, but exposed only `SchemaError: Expected effect/HttpApiError/Unauthorized`, masking the underlying read failure.
- The local-dev fix restored local startup while leaving the shared deployment store broken.
- We had no independently recoverable copy of the previous encryption key. A key saved only inside state encrypted with that key cannot recover itself.

## Recovery

1. **Preserve evidence.** Saved the deployed state-store Worker, bindings, readable bootstrap state, and encrypted records in a restricted local recovery directory. A temporary authenticated, read-only export path copied ciphertext. We then restored the original Worker code and verified its bindings and compatibility settings.
2. **Test the key offline.** Confirmed the decoding failure without changing stored records. Checked available local state and credential backups and Time Machine availability; none supplied the previous key.
3. **Inventory existing infrastructure.** Read Cloudflare resource names, IDs, Worker bindings, queue consumers, email configuration, and zone configuration. Resource-name listings remained readable even when record contents did not.
4. **Build an isolated draft.** Used Alchemy's provider reads to reconstruct 32 cloud-resource records. The draft state backend rejected writes, and the planning scripts only allowed dry runs. Two unavailable local credential values used draft-only placeholders; no placeholder survived into the published candidate state. Secret values that could not be observed were omitted from recorded props so CI would reconcile them from its required configuration.
5. **Preserve resource identity and migration history.** Recovered the naming prefixes used by generated physical names, retained observed resource IDs, and checked all 10 hashes in the existing `d1_migrations` table against repository files. Stamped the existing table and hashes into the candidate database state. This made the database a no-op in the final plan.
6. **Review the plan against the original declarations.** The plan contained 16 no-ops, 16 updates, and one build creation. There were no deletions or replacements. Updates covered six Workers and ten configured secrets. `Www/Build` was a disposable build-cache record, not a missing cloud resource.
7. **Publish the approved recovery.** Wrote the 32 records and stack output to `gbfm/prod`, verified each by reading it back, and removed the unreadable `Www/Build` cache record. Verified that no replacement cleanup remained.
8. **Rerun CI.** Attempt 2 of the same run deployed the same commit using GitHub's production credentials. Alchemy rebuilt the website and saved the resulting 33 resource records to the normal remote state store.

We did not reset the shared store or restore the previous key. Blindly resetting state could have lost resource tracking; rolling back Worker code would not by itself recover a missing encryption key.

## Verification

- [Deployment attempt 2](https://github.com/guidefari/gbfm/actions/runs/40069327660/attempts/2) passed, including its traffic checks.
- All six Workers carried release `588a92864d38093a9e509405448cf138eabd868d`.
- Compared with the pre-recovery inventory, all six Workers retained their D1, R2, KV, Durable Object, queue, service, and Secrets Store bindings.
- API health, shows API, CDN audio, and website checks returned HTTP 200. The RSS redirect returned HTTP 301.
- All 33 production resource records and the stack output were readable after deployment. A fresh state backup was saved.

These checks establish successful deployment and preservation of the inspected infrastructure references. They are not a full end-to-end test of every application feature.

## What went well

- Existing infrastructure continued serving while deployment state was unreadable.
- Resource listings and Cloudflare metadata allowed reconstruction without the old key.
- Backups, a write-blocked draft, and a no-replacement plan separated diagnosis from production changes.
- We verified the result through both CI and direct checks of live Worker releases, bindings, and state reads.

## Follow-up actions

Completed recovery is separate from recurrence prevention. Proposed actions below are not yet implemented or scheduled.

| Priority | Action | Status and completion criterion |
| --- | --- | --- |
| Immediate | Back up the current encryption key independently | **Done.** Saved as `Alchemy State Store Encryption Key` in 1Password and verified against live bootstrap state. |
| Immediate | Preserve recovery evidence and fresh state | **Done locally.** Restricted backups exist; this is not yet an automated off-machine state-backup process. |
| High | Refuse to replace a key when an existing store is unreadable | **Proposed.** An integration test must prove bootstrap fails without overwriting secrets or state. Confirm the actual key-changing path before choosing a patch. |
| High | Check state readability around state-store upgrades | **Proposed.** Read and decode records from every registered stack/stage before and after an upgrade; a failed read blocks success. |
| High | Add recurring, protected state backups and a restore drill | **Proposed.** Demonstrate that a saved state export and the separately stored key can recover an isolated test store. |
| High | Audit other stages and projects sharing this key | **Proposed.** Record read results and recovery needs separately. Production GBFM recovery does not resolve their old ciphertext. |
| Medium | Make key rotation explicit and versioned | **Proposed.** Retain old keys, identify the key used by each record, migrate records, and verify them before retiring a key. |
| Medium | Improve state-store errors | **Proposed.** Distinguish authentication, key access, decryption, and parsing failures without logging keys, plaintext state, or arbitrary decoder payloads. |
| Medium | Trace the October 13 change and report an upstream reproduction | **Proposed.** Establish the initiating operation and produce a disposable reproduction before attributing the overwrite to an upstream bug. |

## Evidence and operating notes

- Deployment entrypoint: [`alchemy.run.ts`](../../alchemy.run.ts).
- State selection: [`alchemy/state.ts`](../../alchemy/state.ts).
- CI deployment and traffic checks: [`.github/workflows/alchemy-deploy.yml`](../../.github/workflows/alchemy-deploy.yml).
- Required deployment configuration: [`alchemy/config.ts`](../../alchemy/config.ts).
- Local recovery artifacts: `~/.alchemy/recovery/2026-10-24-gbfm/` on the recovery machine. The inventory, ciphertext export, candidate state, publish journal, verification results, and post-deployment state are sensitive operational artifacts. Keep them out of git and issue attachments.
- Independent current-key backup: 1Password item `Alchemy State Store Encryption Key`. No secret value or credential URI is included here.

Future GBFM production deployments use the recovered remote state normally. They do not depend on the local recovery scripts. Protecting that state against another uncoordinated key change remains separate work.
