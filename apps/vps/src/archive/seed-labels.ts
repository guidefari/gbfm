import { log } from 'node:console'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import grayMatter from 'gray-matter'
import * as schema from '../../drizzle/schema'
import { db } from '../db'

const fallbackThumbnailUrl =
  'https://d20tmfka7s58bt.cloudfront.net/gb-default.png'

const dirs = {
  label: './src/archive/labels'
}

const DEFAULT_CREATOR_USERNAME = 'guidefari'

export const readLabelsFromFolder = async () => {
  const dir = path.join(process.cwd(), dirs.label)
  log({ dir })

  const files = await readdir(dir, { recursive: true })

  const results = await Promise.all(
    files
      .filter((file) => file.endsWith('.mdx'))
      .map(async (file) => {
        const content = await Bun.file(`${dir}/${file}`).text()
        const gray = grayMatter(content)
        const slug = file.replace('.mdx', '')

        const description = gray.data.website
          ? `Website: ${gray.data.website}`
          : gray.content.slice(0, 150)

        return {
          title: gray.data.name || slug,
          content: gray.content,
          description: description || '',
          tags: gray.data.genres || [],
          slug,
          thumbnailUrl: gray.data.thumbnailUrl || fallbackThumbnailUrl,
          draft: false,
          type: 'label' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      })
  )

  return results
}

export async function seedLabels() {
  try {
    const labels = await readLabelsFromFolder()

    log(`Seeding ${labels.length} labels...`)

    const guidefariUser = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, DEFAULT_CREATOR_USERNAME))
      .limit(1)

    if (!guidefariUser.length) {
      console.error(
        `❌ User '${DEFAULT_CREATOR_USERNAME}' not found in database.`
      )
      process.exit(1)
    }

    const creatorId = guidefariUser[0].id

    for (const label of labels) {
      try {
        const [insertedPost] = await db
          .insert(schema.posts)
          .values(label)
          .onConflictDoNothing()
          .returning()

        if (insertedPost) {
          await db.insert(schema.postCreators).values({
            postId: insertedPost.id,
            creatorId
          })
          log(`✅ Seeded label: ${label.title}`)
        } else {
          log(`⏭️  Skipped duplicate label: ${label.title}`)
        }
      } catch (error) {
        log(`❌ Failed to seed label ${label.title}:`, error)
      }
    }

    log('✅ Labels seeding complete!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error seeding labels:', error)
    process.exit(1)
  }
}

seedLabels()
