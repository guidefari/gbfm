import { and, eq, exists, lte } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { Database } from '@/db/layer'
import { projectEntityLabels, replaceEntityLabels } from '@/db/labels'
import { entityLabelsTable } from '@/db/tags.schema'
import { musicLabelsTable } from '@/db/music-entity.schema'
import {
  type InsertRelease,
  releasesTable,
  type SelectMdxCompiledRelease,
  type SelectRelease
} from '@/db/release.schema'
import {
  ConflictError,
  DatabaseError,
  getErrorMessage,
  NotFoundError,
  type UnauthorizedError
} from '@/errors'
import { requireCreatorOrAdmin } from '@/lib/authorization'
import { compileMDX, isMDXCompilationResult } from '@/lib/mdx'

export interface ReleaseService {
  readonly getBySlug: (
    slug: string
  ) => Effect.Effect<SelectMdxCompiledRelease, DatabaseError | NotFoundError>
  readonly getBySlugForEdit: (
    slug: string,
    userId: string,
    userRole: string
  ) => Effect.Effect<SelectMdxCompiledRelease, DatabaseError | NotFoundError | UnauthorizedError>
  readonly create: (
    data: InsertRelease & { releaseDate: Date },
    userId: string,
    userRole: string
  ) => Effect.Effect<
    SelectRelease,
    DatabaseError | NotFoundError | ConflictError | UnauthorizedError
  >
  readonly update: (
    slug: string,
    userId: string,
    userRole: string,
    data: Partial<InsertRelease> & { releaseDate?: Date }
  ) => Effect.Effect<SelectMdxCompiledRelease, DatabaseError | NotFoundError | UnauthorizedError>
  readonly delete: (
    slug: string,
    userId: string,
    userRole: string
  ) => Effect.Effect<void, DatabaseError | NotFoundError | UnauthorizedError>
}

export const ReleaseService = Context.Service<ReleaseService>('ReleaseService')

type DatabaseConnection = Context.Service.Shape<typeof Database>

const getBySlugEffect = (db: DatabaseConnection, slug: string, includeDrafts = false) =>
  Effect.gen(function* () {
    const releaseRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(releasesTable)
          .where(
            includeDrafts
              ? eq(releasesTable.slug, slug)
              : and(
                  eq(releasesTable.slug, slug),
                  eq(releasesTable.draft, false),
                  exists(
                    db
                      .select({ id: musicLabelsTable.id })
                      .from(musicLabelsTable)
                      .where(
                        and(
                          eq(musicLabelsTable.id, releasesTable.labelId),
                          lte(musicLabelsTable.publishedAt, new Date())
                        )
                      )
                  )
                )
          )
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch release: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'releases'
        })
    })

    const release = releaseRecords[0]
    if (!release) {
      return yield* new NotFoundError({
        message: 'Release not found',
        resource: 'release',
        id: slug
      })
    }

    const { tags } = yield* Effect.tryPromise({
      try: () => projectEntityLabels(db, 'release', release),
      catch: (error) =>
        new DatabaseError({ message: getErrorMessage(error), operation: 'select', table: 'labels' })
    })
    let processedRelease: SelectMdxCompiledRelease = {
      ...release,
      tags,
      compiledContent: ''
    }

    if (release.content) {
      const mdxResult = yield* Effect.tryPromise({
        try: () => compileMDX(release.content),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to compile MDX: ${getErrorMessage(error)}`,
            operation: 'mdx_compile',
            table: 'releases'
          })
      })

      if (isMDXCompilationResult(mdxResult)) {
        processedRelease = {
          ...processedRelease,
          compiledContent: mdxResult.compiled
        }
      }
    }

    return processedRelease
  })

const createEffect = (
  db: DatabaseConnection,
  data: InsertRelease & { releaseDate: Date },
  userId: string,
  userRole: string
) =>
  Effect.gen(function* () {
    const { tags, ...releaseData } = data
    const labelRecords = yield* Effect.tryPromise({
      try: () =>
        db.select().from(musicLabelsTable).where(eq(musicLabelsTable.id, data.labelId)).limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch label: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'music_labels'
        })
    })

    const label = labelRecords[0]
    if (!label) {
      return yield* new NotFoundError({
        message: 'Label not found',
        resource: 'label',
        id: data.labelId
      })
    }

    yield* requireCreatorOrAdmin(db, 'label', label.id, userId, userRole)

    const insertedRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .insert(releasesTable)
          .values({
            ...releaseData,
            releaseDate: data.releaseDate
          })
          .returning(),
      catch: (error) => {
        const errorMessage = getErrorMessage(error)
        if (errorMessage.includes('unique constraint')) {
          return new ConflictError({
            message: 'Release with this slug already exists',
            resource: 'release'
          })
        }
        return new DatabaseError({
          message: `Failed to create release: ${errorMessage}`,
          operation: 'insert',
          table: 'releases'
        })
      }
    })

    const newRelease = insertedRecords[0]
    if (!newRelease) {
      return yield* new DatabaseError({
        message: 'Failed to create release',
        operation: 'insert',
        table: 'releases'
      })
    }

    if (tags !== undefined) {
      yield* Effect.tryPromise({
        try: () => replaceEntityLabels(db, 'release', newRelease.id, { tags }),
        catch: (error) =>
          new DatabaseError({
            message: getErrorMessage(error),
            operation: 'insert',
            table: 'labels'
          })
      })
    }
    return yield* Effect.tryPromise({
      try: () => projectEntityLabels(db, 'release', newRelease),
      catch: (error) =>
        new DatabaseError({ message: getErrorMessage(error), operation: 'select', table: 'labels' })
    })
  })

const updateEffect = (
  db: DatabaseConnection,
  slug: string,
  userId: string,
  userRole: string,
  data: Partial<InsertRelease> & { releaseDate?: Date }
) =>
  Effect.gen(function* () {
    const { tags, ...releaseData } = data
    const existingRecords = yield* Effect.tryPromise({
      try: () => db.select().from(releasesTable).where(eq(releasesTable.slug, slug)).limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to check release existence: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'releases'
        })
    })

    const existingRelease = existingRecords[0]
    if (!existingRelease) {
      return yield* new NotFoundError({
        message: 'Release not found',
        resource: 'release',
        id: slug
      })
    }

    yield* requireCreatorOrAdmin(db, 'label', existingRelease.labelId, userId, userRole)

    if (data.labelId && data.labelId !== existingRelease.labelId) {
      const destinationLabelId = data.labelId
      const destinationLabels = yield* Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(musicLabelsTable)
            .where(eq(musicLabelsTable.id, destinationLabelId))
            .limit(1),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to fetch destination label: ${getErrorMessage(error)}`,
            operation: 'select',
            table: 'music_labels'
          })
      })
      const destinationLabel = destinationLabels[0]
      if (!destinationLabel) {
        return yield* new NotFoundError({
          message: 'Label not found',
          resource: 'label',
          id: data.labelId
        })
      }
      yield* requireCreatorOrAdmin(db, 'label', destinationLabel.id, userId, userRole)
    }

    const updatedRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .update(releasesTable)
          .set({
            ...releaseData,
            updatedAt: new Date(),
            releaseDate: data.releaseDate ?? existingRelease.releaseDate
          })
          .where(eq(releasesTable.id, existingRelease.id))
          .returning(),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to update release: ${getErrorMessage(error)}`,
          operation: 'update',
          table: 'releases'
        })
    })

    const updatedRelease = updatedRecords[0]
    if (!updatedRelease) {
      return yield* new DatabaseError({
        message: 'Failed to update release',
        operation: 'update',
        table: 'releases'
      })
    }

    if (tags !== undefined) {
      yield* Effect.tryPromise({
        try: () => replaceEntityLabels(db, 'release', updatedRelease.id, { tags }),
        catch: (error) =>
          new DatabaseError({
            message: getErrorMessage(error),
            operation: 'update',
            table: 'labels'
          })
      })
    }

    const { tags: projectedTags } = yield* Effect.tryPromise({
      try: () => projectEntityLabels(db, 'release', updatedRelease),
      catch: (error) =>
        new DatabaseError({ message: getErrorMessage(error), operation: 'select', table: 'labels' })
    })

    const baseProcessedRelease: SelectMdxCompiledRelease = {
      ...updatedRelease,
      tags: projectedTags,
      compiledContent: ''
    }

    if (updatedRelease.content) {
      const mdxResult = yield* Effect.tryPromise({
        try: () => compileMDX(updatedRelease.content),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to compile MDX: ${getErrorMessage(error)}`,
            operation: 'mdx_compile',
            table: 'releases'
          })
      })

      if (isMDXCompilationResult(mdxResult)) {
        return {
          ...baseProcessedRelease,
          compiledContent: mdxResult.compiled
        }
      }
    }

    return baseProcessedRelease
  })

const deleteEffect = (db: DatabaseConnection, slug: string, userId: string, userRole: string) =>
  Effect.gen(function* () {
    const existingRecords = yield* Effect.tryPromise({
      try: () => db.select().from(releasesTable).where(eq(releasesTable.slug, slug)).limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to check release existence: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'releases'
        })
    })

    const existingRelease = existingRecords[0]
    if (!existingRelease) {
      return yield* new NotFoundError({
        message: 'Release not found',
        resource: 'release',
        id: slug
      })
    }

    yield* requireCreatorOrAdmin(db, 'label', existingRelease.labelId, userId, userRole)

    yield* Effect.tryPromise({
      try: () =>
        db.batch([
          db
            .delete(entityLabelsTable)
            .where(
              and(
                eq(entityLabelsTable.entityType, 'release'),
                eq(entityLabelsTable.entityId, existingRelease.id)
              )
            ),
          db.delete(releasesTable).where(eq(releasesTable.id, existingRelease.id))
        ]),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to delete release: ${getErrorMessage(error)}`,
          operation: 'delete',
          table: 'releases'
        })
    })
  })

export const ReleaseServiceLayer = Layer.effect(
  ReleaseService,
  Effect.gen(function* () {
    const db = yield* Database
    return {
      getBySlug: (slug) =>
        getBySlugEffect(db, slug).pipe(
          Effect.withSpan('release.getBySlug', { attributes: { slug } })
        ),
      getBySlugForEdit: (slug, userId, userRole) =>
        Effect.gen(function* () {
          const release = yield* getBySlugEffect(db, slug, true)
          yield* requireCreatorOrAdmin(db, 'label', release.labelId, userId, userRole)
          return release
        }).pipe(Effect.withSpan('release.getBySlugForEdit', { attributes: { slug } })),
      create: (data, userId, userRole) =>
        createEffect(db, data, userId, userRole).pipe(Effect.withSpan('release.create')),
      update: (slug, userId, userRole, data) =>
        updateEffect(db, slug, userId, userRole, data).pipe(
          Effect.withSpan('release.update', { attributes: { slug } })
        ),
      delete: (slug, userId, userRole) =>
        deleteEffect(db, slug, userId, userRole).pipe(
          Effect.withSpan('release.delete', { attributes: { slug } })
        )
    }
  })
)
