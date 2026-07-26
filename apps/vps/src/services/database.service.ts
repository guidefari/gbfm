import { Context, Layer } from 'effect'
import { db } from '@/db'

export interface DatabaseService {
  readonly db: typeof db
}

export const DatabaseService = Context.Service<DatabaseService>('DatabaseService')

export const DatabaseServiceLayer = Layer.succeed(DatabaseService, { db })
