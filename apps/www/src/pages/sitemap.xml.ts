import { env } from 'cloudflare:workers'

/** Proxies the generated sitemap from the API service binding. */
export const GET = ({ request }: { readonly request: Request }) => env.API.fetch(request)
