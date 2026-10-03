type WithoutUndefined<T extends object> = {
  [K in keyof T as undefined extends T[K] ? never : K]: T[K]
} & {
  [K in keyof T as undefined extends T[K] ? K : never]?: Exclude<T[K], undefined>
}

/** Returns a shallow copy without properties whose value is `undefined`. */
export const omitUndefined = <T extends object>(value: T): WithoutUndefined<T> =>
  // SAFETY: filtering establishes that every retained property excludes `undefined`.
  // oxlint-disable-next-line typescript/consistent-type-assertions, typescript/no-unsafe-type-assertion -- SAFETY: Object.fromEntries loses the key/value relationship established by the predicate.
  Object.fromEntries(
    Object.entries(value).filter((entry) => entry[1] !== undefined),
  ) as WithoutUndefined<T>
