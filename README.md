## Current architecture
Dev & infra via [SST](https://sst.dev)

# Packages
### Frontend
- Vite + React
- The idea is also to have an `agnostic` or well separated frontend. I was starting to feel too locked into NextJS/Vercel.

### Backend
- `packages/functions/api` defines & exposes routes
- I'm yet to explore cron & events

### Core business logic
- `packages/core` is where it's at.
    - For now, this just houses the logic for my spotify proxy

---

# Infra
- Infra folder defines all the SST constructs being used in the app
- Then all brought together in [sst config](sst.config.ts)

### DB strategy
- For the sake of progress, I think it's best to stick to Supabase for initial dev
- See if I can do my interfaces well enough, such that I can plug in different Postgres providers as I see fit.

### Auth strategy
- With the heading above in mind, it also makes sense to stick to the Lucia/Postgres setup for auth
- Again, seeking independence here & don't want to be reliant on proprietary tech for auth.
- Not yet, at least. I want to learn how the sausage is made before abstracting it away.

- [ ] How will I handle protected routes?
  - Potentially, it's just about getting the session id via request cookies & checking that exists in my session table?

### Transactional email
- SES.

