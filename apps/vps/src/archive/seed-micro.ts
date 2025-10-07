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
  microPost: './src/archive/micro'
}

const DEFAULT_AUTHOR_USERNAME = 'guidefari'

export const readMicroPostsFromFolder = async () => {
  const dir = path.join(process.cwd(), dirs.microPost)
  log({ dir })

  const files = await readdir(dir, { recursive: true })

  const results = await Promise.all(
    files
      .filter((file) => file.endsWith('.mdx'))
      .map(async (file) => {
        const content = await Bun.file(`${dir}/${file}`).text()
        const gray = grayMatter(content)
        const slug = file.replace('.mdx', '')

        return {
          title: gray.data.authorName || slug,
          content: gray.content,
          description: gray.content.slice(0, 150) || '',
          tags: [],
          slug,
          thumbnailUrl: gray.data.avatarUrl || fallbackThumbnailUrl,
          draft: false,
          type: 'micro' as const,
          createdAt: gray.data.date
            ? new Date(gray.data.date).toISOString()
            : new Date().toISOString(),
          updatedAt: gray.data.date
            ? new Date(gray.data.date).toISOString()
            : new Date().toISOString()
        }
      })
  )

  return results
}

export async function seedMicroPosts() {
  try {
    const microPosts = await readMicroPostsFromFolder()

    log(`Seeding ${microPosts.length} micro posts...`)

    const guidefariAuthor = await db
      .select()
      .from(schema.authors)
      .where(eq(schema.authors.username, DEFAULT_AUTHOR_USERNAME))
      .limit(1)

    if (!guidefariAuthor[0]) {
      console.error(
        `❌ Author '${DEFAULT_AUTHOR_USERNAME}' not found in database.`
      )
      process.exit(1)
    }

    const authorId = guidefariAuthor[0].id

    for (const microPost of microPosts) {
      try {
        const [insertedPost] = await db
          .insert(schema.posts)
          .values(microPost)
          .onConflictDoNothing()
          .returning()

        if (insertedPost) {
          await db.insert(schema.postsToAuthors).values({
            postId: insertedPost.id,
            authorId
          })
          log(`✅ Seeded micro post: ${microPost.slug}`)
        } else {
          log(`⏭️  Skipped duplicate micro post: ${microPost.slug}`)
        }
      } catch (error) {
        log(`❌ Failed to seed micro post ${microPost.slug}:`, error)
      }
    }

    log('✅ Micro posts seeding complete!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error seeding micro posts:', error)
    process.exit(1)
  }
}

seedMicroPosts()
