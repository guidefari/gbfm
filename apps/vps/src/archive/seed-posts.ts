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
  post: './src/archive/words'
}

const DEFAULT_CREATOR_USERNAME = 'guidefari'

export const readPostsFromFolder = async () => {
  const dir = path.join(process.cwd(), dirs.post)
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
          title: gray.data.title,
          content: gray.content,
          description: gray.data.description || '',
          tags: gray.data.tags || [],
          slug,
          thumbnailUrl: gray.data.thumbnailUrl || fallbackThumbnailUrl,
          draft: gray.data.draft || false,
          type: 'post' as const,
          createdAt: gray.data.date
            ? new Date(gray.data.date).toISOString()
            : new Date().toISOString(),
          updatedAt: gray.data.lastmod
            ? new Date(gray.data.lastmod).toISOString()
            : gray.data.date
              ? new Date(gray.data.date).toISOString()
              : new Date().toISOString(),
          creatorUsernames: gray.data.creators || [DEFAULT_CREATOR_USERNAME]
        }
      })
  )

  return results
}

export async function seedPosts() {
  try {
    const posts = await readPostsFromFolder()

    log(`Seeding ${posts.length} posts...`)

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

    if (!guidefariUser[0]) {
      console.error(
        `❌ User '${DEFAULT_CREATOR_USERNAME}' not found in database.`
      )
      process.exit(1)
    }

    const creatorId = guidefariUser[0].id

    for (const post of posts) {
      try {
        const { creatorUsernames, ...postData } = post

        const [insertedPost] = await db
          .insert(schema.posts)
          .values(postData)
          .onConflictDoNothing()
          .returning()

        if (insertedPost) {
          await db.insert(schema.postCreators).values({
            postId: insertedPost.id,
            creatorId
          })
          log(`✅ Seeded post: ${post.title}`)
        } else {
          log(`⏭️  Skipped duplicate post: ${post.title}`)
        }
      } catch (error) {
        log(`❌ Failed to seed post ${post.title}:`, error)
      }
    }

    log('✅ Posts seeding complete!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error seeding posts:', error)
    process.exit(1)
  }
}

seedPosts()
