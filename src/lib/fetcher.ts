export default async function fetcher<T = any>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init)

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return res.json()
}
