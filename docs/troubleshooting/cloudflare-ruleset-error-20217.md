# Cloudflare Ruleset Error 20217

## Overview

Production deployments fail with Cloudflare API error `20217` when SST/Pulumi tries to **create** a zone ruleset for a phase that already has one. Cloudflare only allows **one zone ruleset per phase** (e.g. `http_request_dynamic_redirect`).

**Error Code:** `20217`
**Cloudflare API:** `POST /zones/{zone_id}/rulesets`

---

## Error Details

```
failed to make http request: POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/rulesets": 400 Bad Request {
  "errors": [
    {
      "code": 20217,
      "message": "'zone' is not a valid value for kind because exceeded maximum number of zone rulesets for phase http_request_dynamic_redirect",
      "source": { "pointer": "/kind" }
    }
  ]
}
```

## Root Cause

A ruleset for the `http_request_dynamic_redirect` phase was created **outside of SST/Pulumi** (e.g. via the Cloudflare dashboard or API). Since Pulumi doesn't know about it (it's not in Pulumi state), it tries to POST a new one, which Cloudflare rejects.

**Key detail:** `sst refresh` does NOT fix this — it only syncs resources already tracked in Pulumi state. It cannot discover resources created outside of Pulumi.

## Resolution

### Option A: Delete the orphaned ruleset and redeploy (quickest)

1. Find the existing ruleset ID:

```
GET https://api.cloudflare.com/client/v4/zones/{zone_id}/rulesets/phases/http_request_dynamic_redirect/entrypoint
Authorization: Bearer {CF_API_TOKEN}
```

2. Delete it:

```
DELETE https://api.cloudflare.com/client/v4/zones/{zone_id}/rulesets/{ruleset_id}
Authorization: Bearer {CF_API_TOKEN}
```

3. Redeploy — SST will create the ruleset fresh and track it in state.

### Option B: Import into Pulumi state (didn't work for us)

The deploy workflow has a `cf_ruleset_import` input that passes a Pulumi import ID (e.g. `zones/{zone_id}/{ruleset_id}`) via the `CF_RULESET_IMPORT` env var.

In practice, this **failed** because the existing Cloudflare resource had different properties (name: `"RSS Feed Redirects"`) than our SST definition (name: `"VPS Route Redirects"`). Pulumi imports the resource but then tries to update it in the same deploy, which fails with:

```
previously-imported resources that still specify an ID may not be replaced
```

The import gets rolled back, leaving you back at square one. This approach only works if your SST definition **exactly matches** the existing Cloudflare resource — which is unlikely if it was created manually. **Use Option A instead.**

## Debug Steps

1. **Confirm the error** — look for error code `20217` in deploy logs.

2. **Inspect existing rulesets** via API:

   ```
   GET https://api.cloudflare.com/client/v4/zones/{zone_id}/rulesets
   Authorization: Bearer {CF_API_TOKEN}
   ```

3. **Filter to the redirect phase:**

   ```
   GET https://api.cloudflare.com/client/v4/zones/{zone_id}/rulesets/phases/http_request_dynamic_redirect/entrypoint
   Authorization: Bearer {CF_API_TOKEN}
   ```

4. **Check Pulumi state** — if the ruleset is NOT in state, Pulumi will try to create instead of update.

## Prevention

- **Never create redirect rulesets manually** in the Cloudflare dashboard for zones managed by SST. All redirect rules should be defined in `infra/dns.ts`.
- If you must create rules manually, import them into Pulumi state before the next deploy.

## Related Files

- `infra/dns.ts` — Cloudflare ruleset definition
- `docs/architecture/cloudflare-redirects.md`

The `cf_ruleset_import` workflow input lived in `.github/workflows/deploy.yml`,
removed on 2026-08-14 with the rest of the SST deploy path. The redirect
ruleset is now Alchemy's `VpsRedirects`, so this Pulumi-state failure mode no
longer applies to production.

## Related Commits

- `c3dfbd3` — `chore(ci): import existing cloudflare ruleset`
- `8218a0c` — `infra: bucketPolicyConfig and CronV2`
- `d321363` — `Enable Cloudflare proxy and fix DNS routing for dynamic content (#88)`
