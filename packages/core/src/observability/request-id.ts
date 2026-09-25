const REQUEST_ID = /^[a-zA-Z0-9_-]{1,128}$/

export const resolveRequestId = (
  incoming: string | null | undefined,
  generate: () => string = () => crypto.randomUUID(),
): string => (incoming && REQUEST_ID.test(incoming) ? incoming : generate())
