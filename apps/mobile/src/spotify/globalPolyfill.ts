export const hasGlobal = (key: PropertyKey): boolean => Reflect.has(globalThis, key)

export const getGlobal = (key: PropertyKey): unknown => Reflect.get(globalThis, key)

export const setGlobal = (key: PropertyKey, value: unknown): void => {
  Reflect.set(globalThis, key, value)
}
