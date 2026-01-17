import { Context, Layer } from 'effect'
import { db } from '@/db'
import { EmailServiceLive } from '@/services/email.service'

// Database Service
// Provides access to the Drizzle database instance
export interface DatabaseService {
  readonly db: typeof db
}

export const DatabaseService =
  Context.GenericTag<DatabaseService>('DatabaseService')

export const DatabaseServiceLive = Layer.succeed(DatabaseService, {
  db
})

// Application Layer - combines all services
// This is the main layer that provides all dependencies for the application
export const AppLayer = Layer.mergeAll(DatabaseServiceLive, EmailServiceLive)
