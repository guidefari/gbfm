import 'dotenv/config'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import grayMatter from 'gray-matter'
import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { audioTable } from '../src/db/audio.schema'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const db = drizzle(pool)

function parseDate(dateString: string): Date {
  const months: Record<string, number> = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11,
  }

  const match = dateString.match(/^(\w+)\s+(\d{1,2})\s+(\d{4})$/)
  if (!match || !match[1] || !match[2] || !match[3]) {
    throw new Error(`Invalid date format: ${dateString}`)
  }

  const monthStr = match[1]
  const day = match[2]
  const year = match[3]
  const month = months[monthStr.toLowerCase()]

  if (month === undefined) {
    throw new Error(`Invalid month: ${monthStr}`)
  }

  return new Date(Date.UTC(Number.parseInt(year), month, Number.parseInt(day)))
}

const MIXES_DIR = path.join(process.cwd(), 'src/archive/mixes')

async function fixMixCreatedDates() {
  console.log('Starting mix date correction...')

  const files = await readdir(MIXES_DIR, { recursive: true })
  const mdxFiles = files.filter((file) => file.endsWith('.mdx'))

  console.log(`Found ${mdxFiles.length} MDX files`)

  let updated = 0
  let skipped = 0
  let errors = 0

  for (const file of mdxFiles) {
    try {
      const content = await Bun.file(path.join(MIXES_DIR, file)).text()
      const { data } = grayMatter(content)
      const slug = file.replace('.mdx', '')

      if (!data.date) {
        console.warn(`⚠️  No date found in ${file}`)
        skipped++
        continue
      }

      let createdAt: Date
      try {
        createdAt = parseDate(data.date)
      } catch (parseError) {
        console.error(`❌ Invalid date in ${file}: ${data.date}`)
        errors++
        continue
      }

      const [existingMix] = await db
        .select()
        .from(audioTable)
        .where(and(eq(audioTable.slug, slug), eq(audioTable.type, 'mix')))
        .limit(1)

      if (!existingMix) {
        console.warn(`⚠️  Mix not found in DB: ${slug}`)
        skipped++
        continue
      }

      let updatedAt: Date
      if (data.lastmod) {
        try {
          updatedAt = parseDate(data.lastmod)
        } catch {
          updatedAt = createdAt
        }
      } else {
        updatedAt = createdAt
      }

      await db
        .update(audioTable)
        .set({
          createdAt,
          updatedAt
        })
        .where(eq(audioTable.id, existingMix.id))

      console.log(`✅ Updated ${slug}: ${createdAt.toISOString()}`)
      updated++
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error)
      errors++
    }
  }

  console.log('\n📊 Summary:')
  console.log(`  Updated: ${updated}`)
  console.log(`  Skipped: ${skipped}`)
  console.log(`  Errors: ${errors}`)
  console.log(`  Total: ${mdxFiles.length}`)
}

fixMixCreatedDates()
  .catch((err) => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
  .finally(() => {
    pool.end()
  })
