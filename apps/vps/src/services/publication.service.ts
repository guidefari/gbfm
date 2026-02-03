import { and, count, eq } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { db } from '@/db'
import {
  type InsertPublication,
  publicationMembers,
  publicationPosts,
  publicationsTable,
  type SelectPublication
} from '@/db/publication.schema'
import {
  ConflictError,
  DatabaseError,
  getErrorMessage,
  NotFoundError
} from '@/errors'

// Service interface
export interface PublicationService {
  readonly createPublication: (
    data: InsertPublication
  ) => Effect.Effect<SelectPublication, DatabaseError | ConflictError>

  readonly getPublicationById: (
    id: string
  ) => Effect.Effect<SelectPublication, DatabaseError | NotFoundError>

  readonly getPublicationBySlug: (
    slug: string
  ) => Effect.Effect<SelectPublication, DatabaseError | NotFoundError>

  readonly getPublications: (
    limit?: number,
    offset?: number
  ) => Effect.Effect<
    {
      data: SelectPublication[]
      total: number
    },
    DatabaseError
  >

  readonly updatePublication: (
    id: string,
    data: Partial<InsertPublication>
  ) => Effect.Effect<SelectPublication, DatabaseError | NotFoundError>

  readonly deletePublication: (
    id: string
  ) => Effect.Effect<SelectPublication, DatabaseError | NotFoundError>

  readonly addPublicationMember: (
    publicationId: string,
    userId: string
  ) => Effect.Effect<void, DatabaseError | NotFoundError | ConflictError>

  readonly removePublicationMember: (
    publicationId: string,
    userId: string
  ) => Effect.Effect<void, DatabaseError | NotFoundError>

  readonly getPublicationMembers: (publicationId: string) => Effect.Effect<
    {
      userId: string
      publicationId: string
    }[],
    DatabaseError | NotFoundError
  >

  readonly addPublicationPost: (
    publicationId: string,
    postId: string
  ) => Effect.Effect<void, DatabaseError | NotFoundError | ConflictError>

  readonly removePublicationPost: (
    publicationId: string,
    postId: string
  ) => Effect.Effect<void, DatabaseError | NotFoundError>
}

// Service tag for dependency injection
export const PublicationService =
  Context.GenericTag<PublicationService>('PublicationService')

// Core service logic - pure Effects with no service dependencies
const createPublicationEffect = (data: InsertPublication) =>
  Effect.gen(function* () {
    // Check if slug already exists
    const existingRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(publicationsTable)
          .where(eq(publicationsTable.slug, data.slug))
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to check publication slug existence: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'publications'
        })
    })

    if (existingRecords.length > 0) {
      return yield* new ConflictError({
        message: 'Publication with this slug already exists',
        resource: 'publication',
        id: data.slug
      })
    }

    // Create publication
    const insertedRecords = yield* Effect.tryPromise({
      try: () => db.insert(publicationsTable).values(data).returning(),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to create publication: ${getErrorMessage(error)}`,
          operation: 'insert',
          table: 'publications'
        })
    })

    const publication = insertedRecords[0]
    if (!publication) {
      return yield* new DatabaseError({
        message: 'Failed to create publication record',
        operation: 'insert',
        table: 'publications'
      })
    }

    return publication
  })

const getPublicationByIdEffect = (id: string) =>
  Effect.gen(function* () {
    const records = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(publicationsTable)
          .where(eq(publicationsTable.id, id))
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to get publication by ID: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'publications'
        })
    })

    const publication = records[0]
    if (!publication) {
      return yield* new NotFoundError({
        message: 'Publication not found',
        resource: 'publication',
        id
      })
    }

    return publication
  })

const getPublicationBySlugEffect = (slug: string) =>
  Effect.gen(function* () {
    const records = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(publicationsTable)
          .where(eq(publicationsTable.slug, slug))
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to get publication by slug: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'publications'
        })
    })

    const publication = records[0]
    if (!publication) {
      return yield* new NotFoundError({
        message: 'Publication not found',
        resource: 'publication',
        id: slug
      })
    }

    return publication
  })

const getPublicationsEffect = (limit = 20, offset = 0) =>
  Effect.gen(function* () {
    // Get total count
    const countResult = yield* Effect.tryPromise({
      try: () => db.select({ total: count() }).from(publicationsTable),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to count publications: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'publications'
        })
    })

    const total = countResult[0]?.total ?? 0

    // Get paginated data
    const data = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(publicationsTable)
          .limit(limit)
          .offset(offset)
          .orderBy(publicationsTable.name),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to get publications: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'publications'
        })
    })

    return { data, total }
  })

const updatePublicationEffect = (
  id: string,
  data: Partial<InsertPublication>
) =>
  Effect.gen(function* () {
    // Check if publication exists
    yield* getPublicationByIdEffect(id)

    // Update publication
    const updatedRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .update(publicationsTable)
          .set(data)
          .where(eq(publicationsTable.id, id))
          .returning(),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to update publication: ${getErrorMessage(error)}`,
          operation: 'update',
          table: 'publications'
        })
    })

    const publication = updatedRecords[0]
    if (!publication) {
      return yield* new NotFoundError({
        message: 'Publication not found',
        resource: 'publication',
        id
      })
    }

    return publication
  })

const deletePublicationEffect = (id: string) =>
  Effect.gen(function* () {
    // Check if publication exists
    yield* getPublicationByIdEffect(id)

    // Delete publication (cascade will handle members and posts)
    const deletedRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .delete(publicationsTable)
          .where(eq(publicationsTable.id, id))
          .returning(),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to delete publication: ${getErrorMessage(error)}`,
          operation: 'delete',
          table: 'publications'
        })
    })

    const publication = deletedRecords[0]
    if (!publication) {
      return yield* new DatabaseError({
        message: 'Failed to delete publication record',
        operation: 'delete',
        table: 'publications'
      })
    }

    return publication
  })

const addPublicationMemberEffect = (publicationId: string, userId: string) =>
  Effect.gen(function* () {
    // Check if publication exists
    yield* getPublicationByIdEffect(publicationId)

    // Check if already a member
    const existingRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(publicationMembers)
          .where(
            and(
              eq(publicationMembers.publicationId, publicationId),
              eq(publicationMembers.userId, userId)
            )
          )
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to check publication member existence: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'publication_members'
        })
    })

    if (existingRecords.length > 0) {
      return yield* new ConflictError({
        message: 'User is already a member of this publication',
        resource: 'publication_member',
        id: `${publicationId}-${userId}`
      })
    }

    // Add member
    yield* Effect.tryPromise({
      try: () =>
        db.insert(publicationMembers).values({
          publicationId,
          userId
        }),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to add publication member: ${getErrorMessage(error)}`,
          operation: 'insert',
          table: 'publication_members'
        })
    })
  })

const removePublicationMemberEffect = (publicationId: string, userId: string) =>
  Effect.gen(function* () {
    // Check if member exists
    const existingRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(publicationMembers)
          .where(
            and(
              eq(publicationMembers.publicationId, publicationId),
              eq(publicationMembers.userId, userId)
            )
          )
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to check publication member existence: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'publication_members'
        })
    })

    if (existingRecords.length === 0) {
      return yield* new NotFoundError({
        message: 'Publication member not found',
        resource: 'publication_member',
        id: `${publicationId}-${userId}`
      })
    }

    // Remove member
    yield* Effect.tryPromise({
      try: () =>
        db
          .delete(publicationMembers)
          .where(
            and(
              eq(publicationMembers.publicationId, publicationId),
              eq(publicationMembers.userId, userId)
            )
          ),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to remove publication member: ${getErrorMessage(error)}`,
          operation: 'delete',
          table: 'publication_members'
        })
    })
  })

const getPublicationMembersEffect = (publicationId: string) =>
  Effect.gen(function* () {
    // Check if publication exists
    yield* getPublicationByIdEffect(publicationId)

    // Get members
    const members = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(publicationMembers)
          .where(eq(publicationMembers.publicationId, publicationId)),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to get publication members: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'publication_members'
        })
    })

    return members
  })

const addPublicationPostEffect = (publicationId: string, postId: string) =>
  Effect.gen(function* () {
    // Check if publication exists
    yield* getPublicationByIdEffect(publicationId)

    // Check if already associated
    const existingRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(publicationPosts)
          .where(
            and(
              eq(publicationPosts.publicationId, publicationId),
              eq(publicationPosts.postId, postId)
            )
          )
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to check publication post existence: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'publication_posts'
        })
    })

    if (existingRecords.length > 0) {
      return yield* new ConflictError({
        message: 'Post is already associated with this publication',
        resource: 'publication_post',
        id: `${publicationId}-${postId}`
      })
    }

    // Add association
    yield* Effect.tryPromise({
      try: () =>
        db.insert(publicationPosts).values({
          publicationId,
          postId
        }),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to add publication post: ${getErrorMessage(error)}`,
          operation: 'insert',
          table: 'publication_posts'
        })
    })
  })

const removePublicationPostEffect = (publicationId: string, postId: string) =>
  Effect.gen(function* () {
    // Check if association exists
    const existingRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(publicationPosts)
          .where(
            and(
              eq(publicationPosts.publicationId, publicationId),
              eq(publicationPosts.postId, postId)
            )
          )
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to check publication post existence: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'publication_posts'
        })
    })

    if (existingRecords.length === 0) {
      return yield* new NotFoundError({
        message: 'Publication post association not found',
        resource: 'publication_post',
        id: `${publicationId}-${postId}`
      })
    }

    // Remove association
    yield* Effect.tryPromise({
      try: () =>
        db
          .delete(publicationPosts)
          .where(
            and(
              eq(publicationPosts.publicationId, publicationId),
              eq(publicationPosts.postId, postId)
            )
          ),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to remove publication post: ${getErrorMessage(error)}`,
          operation: 'delete',
          table: 'publication_posts'
        })
    })
  })

// Implementation - simple layer that provides access to the Effects
export const PublicationServiceLive = Layer.succeed(PublicationService, {
  createPublication: (data) =>
    createPublicationEffect(data).pipe(Effect.withSpan('publication.create')),
  getPublicationById: (id) =>
    getPublicationByIdEffect(id).pipe(
      Effect.withSpan('publication.getById', { attributes: { id } })
    ),
  getPublicationBySlug: (slug) =>
    getPublicationBySlugEffect(slug).pipe(
      Effect.withSpan('publication.getBySlug', { attributes: { slug } })
    ),
  getPublications: (limit, offset) =>
    getPublicationsEffect(limit, offset).pipe(
      Effect.withSpan('publication.getAll')
    ),
  updatePublication: (id, data) =>
    updatePublicationEffect(id, data).pipe(
      Effect.withSpan('publication.update', { attributes: { id } })
    ),
  deletePublication: (id) =>
    deletePublicationEffect(id).pipe(
      Effect.withSpan('publication.delete', { attributes: { id } })
    ),
  addPublicationMember: (publicationId, userId) =>
    addPublicationMemberEffect(publicationId, userId).pipe(
      Effect.withSpan('publication.addMember', {
        attributes: { publicationId }
      })
    ),
  removePublicationMember: (publicationId, userId) =>
    removePublicationMemberEffect(publicationId, userId).pipe(
      Effect.withSpan('publication.removeMember', {
        attributes: { publicationId }
      })
    ),
  getPublicationMembers: (publicationId) =>
    getPublicationMembersEffect(publicationId).pipe(
      Effect.withSpan('publication.getMembers', {
        attributes: { publicationId }
      })
    ),
  addPublicationPost: (publicationId, postId) =>
    addPublicationPostEffect(publicationId, postId).pipe(
      Effect.withSpan('publication.addPost', {
        attributes: { publicationId, postId }
      })
    ),
  removePublicationPost: (publicationId, postId) =>
    removePublicationPostEffect(publicationId, postId).pipe(
      Effect.withSpan('publication.removePost', {
        attributes: { publicationId, postId }
      })
    )
})
