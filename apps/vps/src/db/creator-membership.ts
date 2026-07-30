import { eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { audioCreators, audioTable } from '@/db/audio.schema'
import { postCreators, postsTable } from '@/db/post.schema'
import { showCreators, showsTable } from '@/db/show.schema'

/**
 * Membership predicates must stay uncorrelated. Drizzle relational queries
 * (db.query.*) alias the base table, so a correlated subquery built from a
 * standalone db.select() renders the unaliased table name and Postgres rejects
 * it with "invalid reference to FROM-clause entry".
 */

export const audioIdsForCreator = (creatorId: string) =>
  inArray(
    audioTable.id,
    db
      .select({ id: audioCreators.audioId })
      .from(audioCreators)
      .where(eq(audioCreators.creatorId, creatorId))
  )

export const showIdsForCreator = (creatorId: string) =>
  inArray(
    showsTable.id,
    db
      .select({ id: showCreators.showId })
      .from(showCreators)
      .where(eq(showCreators.creatorId, creatorId))
  )

export const postIdsForCreator = (creatorId: string) =>
  inArray(
    postsTable.id,
    db
      .select({ id: postCreators.postId })
      .from(postCreators)
      .where(eq(postCreators.creatorId, creatorId))
  )
