import { eq } from 'drizzle-orm'
import { db } from '../src/db'
import { labelsTable, labelCreators } from '../src/db/label.schema'
import { postsTable, postCreators } from '../src/db/post.schema'

async function migrateLabelsFromPosts() {
  console.log('Starting migration: Moving label posts to labels table...')

  try {
    const labelPosts = await db
      .select()
      .from(postsTable)
      .where(eq(postsTable.type, 'label' as any))

    console.log(`Found ${labelPosts.length} label posts to migrate`)

    if (labelPosts.length === 0) {
      console.log('No label posts found. Migration complete.')
      return
    }

    for (const post of labelPosts) {
      console.log(`Migrating label: ${post.title} (${post.slug})`)

      await db.transaction(async (tx) => {
        const [newLabel] = await tx
          .insert(labelsTable)
          .values({
            title: post.title,
            description: post.description,
            thumbnailUrl: post.thumbnailUrl,
            slug: post.slug,
            content: post.content,
            draft: post.draft,
            tags: post.tags,
            createdAt: post.createdAt,
            updatedAt: post.updatedAt
          })
          .returning()

        if (!newLabel) {
          throw new Error(`Failed to create label for post: ${post.id}`)
        }

        console.log(`  Created label: ${newLabel.id}`)

        const postCreators = await tx
          .select()
          .from(postCreators)
          .where(eq(postCreators.postId, post.id))

        if (postCreators.length > 0) {
          await tx.insert(labelCreators).values(
            postCreators.map((pc) => ({
              labelId: newLabel.id,
              creatorId: pc.creatorId
            }))
          )
          console.log(`  Migrated ${postCreators.length} creator relationship(s)`)
        }

        await tx.delete(postCreators).where(eq(postCreators.postId, post.id))

        await tx.delete(postsTable).where(eq(postsTable.id, post.id))

        console.log(`  Deleted original post: ${post.id}`)
      })
    }

    console.log(`\nMigration complete! Migrated ${labelPosts.length} labels.`)
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  }
}

migrateLabelsFromPosts()
  .then(() => {
    console.log('\nAll done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
