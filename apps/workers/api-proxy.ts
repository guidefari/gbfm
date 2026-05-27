interface Env {
  VPS_HOSTNAME: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    url.hostname = env.VPS_HOSTNAME
    url.pathname = url.pathname.replace(/^\/api/, '') || '/'
    return fetch(new Request(url.toString(), request))
  }
}
