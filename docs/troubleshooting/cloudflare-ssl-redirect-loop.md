# Cloudflare SSL Redirect Loop (ERR_TOO_MANY_REDIRECTS)

## Overview

The site returns `ERR_TOO_MANY_REDIRECTS` when Cloudflare proxy is enabled but the SSL/TLS encryption mode is set to **"Flexible"**.

## Symptoms

- Browser shows "This page isn't working — redirected you too many times"
- `curl -I` shows an infinite `301` loop with `x-cache: Redirect from cloudfront`
- Both `goosebumps.fm` and `www.goosebumps.fm` are affected

```
HTTP/2 301
location: https://goosebumps.fm/
x-cache: Redirect from cloudfront
server: cloudflare
```

## Root Cause

When Cloudflare proxy is enabled (`proxy: true` in `infra/www.ts`) with **"Flexible"** SSL mode:

1. Client sends HTTPS request to Cloudflare
2. Cloudflare terminates SSL and forwards **HTTP** to CloudFront (Flexible = HTTP to origin)
3. CloudFront has "Redirect HTTP to HTTPS" behavior → returns 301 back to HTTPS
4. Request goes back to Cloudflare → step 2 again → infinite loop

## Fix

In the Cloudflare dashboard:

1. Go to the `goosebumps.fm` zone
2. **SSL/TLS → Overview**
3. Change encryption mode from **"Flexible"** to **"Full (Strict)"**

This ensures Cloudflare connects to CloudFront over HTTPS, breaking the loop.

## Why This Happened

Cloudflare proxy was enabled in commit `d321363` (Enable Cloudflare proxy and fix DNS routing for dynamic content). The SSL mode was likely left on "Flexible" (Cloudflare's default for some plans) when it needed to be "Full (Strict)" to work with CloudFront.

## Related Files

- `infra/www.ts` — static site config with `proxy: true`
- `infra/dns.ts` — domain and DNS config
