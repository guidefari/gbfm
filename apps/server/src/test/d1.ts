import { drizzle } from 'drizzle-orm/d1'
import { afterAll } from 'vitest'

import * as schema from '@/db/exports'

import { createMigratedD1Database } from './migrate-d1'

const d1Resource = await createMigratedD1Database()

export const d1 = d1Resource.database

afterAll(() => d1Resource.dispose())

export const db = drizzle(d1, { schema })
