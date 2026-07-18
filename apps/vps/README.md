To install dependencies:

```sh
bun install
```

To run:

```sh
bun run dev
```

open http://127.0.0.1:3003

The local server binds to `0.0.0.0` by default so it is reachable through the
laptop's Tailscale interface. Find that address with `tailscale ip -4`, then
set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to
`http://<laptop-tailscale-ip>:3003` before starting Expo. Set
`VPS_HOSTNAME=127.0.0.1` if you explicitly want localhost-only binding.
