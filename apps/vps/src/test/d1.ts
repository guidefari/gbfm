import { drizzle } from 'drizzle-orm/d1'
import * as schema from '@/db/exports'
import { createMigratedD1Database } from './migrate-d1'

export const d1 = await createMigratedD1Database()
export const db = drizzle(d1, { schema })
