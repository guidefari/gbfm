import { env } from 'cloudflare:workers'

/** Proxies generated social cards from the image Worker. */
export const GET = ({ request }: { readonly request: Request }) => env.SOCIAL_IMAGES.fetch(request)
