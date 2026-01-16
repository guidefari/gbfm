import { eq, notInArray } from 'drizzle-orm'
import { db } from '../src/db'
import { audioCreators, audioTable } from '../src/db/audio.schema'
import { user } from '../src/db/auth.schema'
import { labelCreators, labelsTable } from '../src/db/label.schema'
import { postCreators, postsTable } from '../src/db/post.schema'
import {
  publicationMembers,
  publicationsTable
} from '../src/db/publication.schema'

async function assignAllRelationsToUser() {
  const targetEmail = 'guidefari@icloud.com'
  console.log(
    `Starting migration: Assigning all content to user ${targetEmail}...\n`
  )

  const [targetUser] = await db
    .select()
    .from(user)
    .where(eq(user.email, targetEmail))
    .limit(1)

  if (!targetUser) {
    throw new Error(`User with email ${targetEmail} not found`)
  }

  console.log(`Found target user: ${targetUser.name} (${targetUser.id})\n`)

  let totalCreated = 0
  let totalUpdated = 0

  const audioItems = await db.select({ id: audioTable.id }).from(audioTable)
  const existingAudioCreators = await db
    .select({ audioId: audioCreators.audioId })
    .from(audioCreators)
  const audioIdsWithCreators = new Set(existingAudioCreators.map((r) => r.audioId))
  const audioWithoutCreators = audioItems.filter(
    (a) => !audioIdsWithCreators.has(a.id)
  )

  console.log(`Audio: ${audioItems.length} total, ${audioWithoutCreators.length} without creators`)
  if (audioWithoutCreators.length > 0) {
    await db.insert(audioCreators).values(
      audioWithoutCreators.map((a) => ({
        audioId: a.id,
        creatorId: targetUser.id
      }))
    )
    console.log(`  ✅ Created ${audioWithoutCreators.length} audio_creators entries`)
    totalCreated += audioWithoutCreators.length
  }

  const wrongAudioCreators = await db
    .select()
    .from(audioCreators)
    .where(notInArray(audioCreators.creatorId, [targetUser.id]))
  if (wrongAudioCreators.length > 0) {
    await db.delete(audioCreators).where(notInArray(audioCreators.creatorId, [targetUser.id]))
    await db.insert(audioCreators).values(
      wrongAudioCreators.map((r) => ({
        audioId: r.audioId,
        creatorId: targetUser.id
      }))
    ).onConflictDoNothing()
    console.log(`  ✅ Reassigned ${wrongAudioCreators.length} audio_creators to target user`)
    totalUpdated += wrongAudioCreators.length
  }

  const posts = await db.select({ id: postsTable.id }).from(postsTable)
  const existingPostCreators = await db
    .select({ postId: postCreators.postId })
    .from(postCreators)
  const postIdsWithCreators = new Set(existingPostCreators.map((r) => r.postId))
  const postsWithoutCreators = posts.filter((p) => !postIdsWithCreators.has(p.id))

  console.log(`\nPosts: ${posts.length} total, ${postsWithoutCreators.length} without creators`)
  if (postsWithoutCreators.length > 0) {
    await db.insert(postCreators).values(
      postsWithoutCreators.map((p) => ({
        postId: p.id,
        creatorId: targetUser.id
      }))
    )
    console.log(`  ✅ Created ${postsWithoutCreators.length} post_creators entries`)
    totalCreated += postsWithoutCreators.length
  }

  const wrongPostCreators = await db
    .select()
    .from(postCreators)
    .where(notInArray(postCreators.creatorId, [targetUser.id]))
  if (wrongPostCreators.length > 0) {
    await db.delete(postCreators).where(notInArray(postCreators.creatorId, [targetUser.id]))
    await db.insert(postCreators).values(
      wrongPostCreators.map((r) => ({
        postId: r.postId,
        creatorId: targetUser.id
      }))
    ).onConflictDoNothing()
    console.log(`  ✅ Reassigned ${wrongPostCreators.length} post_creators to target user`)
    totalUpdated += wrongPostCreators.length
  }

  const labels = await db.select({ id: labelsTable.id }).from(labelsTable)
  const existingLabelCreators = await db
    .select({ labelId: labelCreators.labelId })
    .from(labelCreators)
  const labelIdsWithCreators = new Set(existingLabelCreators.map((r) => r.labelId))
  const labelsWithoutCreators = labels.filter((l) => !labelIdsWithCreators.has(l.id))

  console.log(`\nLabels: ${labels.length} total, ${labelsWithoutCreators.length} without creators`)
  if (labelsWithoutCreators.length > 0) {
    await db.insert(labelCreators).values(
      labelsWithoutCreators.map((l) => ({
        labelId: l.id,
        creatorId: targetUser.id
      }))
    )
    console.log(`  ✅ Created ${labelsWithoutCreators.length} label_creators entries`)
    totalCreated += labelsWithoutCreators.length
  }

  const wrongLabelCreators = await db
    .select()
    .from(labelCreators)
    .where(notInArray(labelCreators.creatorId, [targetUser.id]))
  if (wrongLabelCreators.length > 0) {
    await db.delete(labelCreators).where(notInArray(labelCreators.creatorId, [targetUser.id]))
    await db.insert(labelCreators).values(
      wrongLabelCreators.map((r) => ({
        labelId: r.labelId,
        creatorId: targetUser.id
      }))
    ).onConflictDoNothing()
    console.log(`  ✅ Reassigned ${wrongLabelCreators.length} label_creators to target user`)
    totalUpdated += wrongLabelCreators.length
  }


  const publications = await db
    .select({ id: publicationsTable.id })
    .from(publicationsTable)
  const existingPubMembers = await db
    .select({ publicationId: publicationMembers.publicationId })
    .from(publicationMembers)
  const pubIdsWithMembers = new Set(existingPubMembers.map((r) => r.publicationId))
  const pubsWithoutMembers = publications.filter(
    (p) => !pubIdsWithMembers.has(p.id)
  )

  console.log(`\nPublications: ${publications.length} total, ${pubsWithoutMembers.length} without members`)
  if (pubsWithoutMembers.length > 0) {
    await db.insert(publicationMembers).values(
      pubsWithoutMembers.map((p) => ({
        publicationId: p.id,
        userId: targetUser.id
      }))
    )
    console.log(`  ✅ Created ${pubsWithoutMembers.length} publication_members entries`)
    totalCreated += pubsWithoutMembers.length
  }

  const wrongPubMembers = await db
    .select()
    .from(publicationMembers)
    .where(notInArray(publicationMembers.userId, [targetUser.id]))
  if (wrongPubMembers.length > 0) {
    await db.delete(publicationMembers).where(notInArray(publicationMembers.userId, [targetUser.id]))
    await db.insert(publicationMembers).values(
      wrongPubMembers.map((r) => ({
        publicationId: r.publicationId,
        userId: targetUser.id
      }))
    ).onConflictDoNothing()
    console.log(`  ✅ Reassigned ${wrongPubMembers.length} publication_members to target user`)
    totalUpdated += wrongPubMembers.length
  }

  console.log(`\n✅ Migration complete!`)
  console.log(`   Created: ${totalCreated} new creator/member entries`)
  console.log(`   Updated: ${totalUpdated} existing entries`)
}

assignAllRelationsToUser()
  .then(() => {
    console.log('\nDone!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  })
