/** Supported object storage providers. */
export const StorageProvider = {
  aws: 'aws',
  r2: 'r2'
} as const

/** A configured object storage provider. */
export type StorageProvider = (typeof StorageProvider)[keyof typeof StorageProvider]
