export const hasGlobal = (key: PropertyKey): boolean => Reflect.has(globalThis, key)

export const setGlobal = <Value>(key: PropertyKey, value: Value): void => {
  Reflect.set(globalThis, key, value)
}
