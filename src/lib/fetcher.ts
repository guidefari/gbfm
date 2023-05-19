export default async function fetcher<JSON = any>(
  input: RequestInfo,
  init?: RequestInit
): Promise<unknown> {
  const res = await fetch(input, init)

  return res.json()
}
