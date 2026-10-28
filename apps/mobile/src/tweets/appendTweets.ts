type Identified = { readonly id: string }

/** New tweets shift offsets between page loads, so later pages can repeat earlier ids. */
export const appendTweets = <T extends Identified>(
  existing: ReadonlyArray<T>,
  incoming: ReadonlyArray<T>,
) => {
  const seen = new Set(existing.map((tweet) => tweet.id))

  return [...existing, ...incoming.filter((tweet) => !seen.has(tweet.id))]
}
