import { and, count, desc, eq } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { db } from '@/db'
import { labelsTable } from '@/db/label.schema'
import {
  type InsertRelease,
  releasesTable,
  type SelectMdxCompiledRelease,
  type SelectRelease
} from '@/db/release.schema'
import { ConflictError, DatabaseError, getErrorMessage, NotFoundError } from '@/errors'
import { compileMDX, isMDXCompilationResult } from '@/lib/mdx'
import { createPaginationMetadata, type PaginationMetadata } from '@/lib/pagination'

export interface ReleaseService {
  readonly getByLabelSlug: (
    labelSlug: string,
    options: { limit: number; offset: number }
  ) => Effect.Effect<
    { data: SelectRelease[]; pagination: PaginationMetadata },
    DatabaseError | NotFoundError
  >
  readonly getBySlug: (
    slug: string
  ) => Effect.Effect<SelectMdxCompiledRelease, DatabaseError | NotFoundError>
  readonly create: (
    data: InsertRelease & { releaseDate: Date }
  ) => Effect.Effect<SelectRelease, DatabaseError | NotFoundError | ConflictError>
  readonly update: (
    slug: string,
    data: Partial<InsertRelease> & { releaseDate?: Date }
  ) => Effect.Effect<SelectMdxCompiledRelease, DatabaseError | NotFoundError>
  readonly delete: (slug: string) => Effect.Effect<void, DatabaseError | NotFoundError>
}

export const ReleaseService = Context.Service<ReleaseService>('ReleaseService')

const getByLabelSlugEffect = (labelSlug: string, options: { limit: number; offset: number }) =>
  Effect.gen(function* () {
    const { limit, offset } = options

    const labelRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(labelsTable)
          .where(and(eq(labelsTable.slug, labelSlug), eq(labelsTable.draft, false)))
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch label: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'labels'
        })
    })

    const label = labelRecords[0]
    if (!label) {
      return yield* new NotFoundError({
        message: 'Label not found',
        resource: 'label',
        id: labelSlug
      })
    }

    const whereCondition = and(eq(releasesTable.labelId, label.id), eq(releasesTable.draft, false))

    const countResult = yield* Effect.tryPromise({
      try: () => db.select({ total: count() }).from(releasesTable).where(whereCondition),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to count releases: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'releases'
        })
    })

    const total = countResult[0]?.total ?? 0

    const data = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(releasesTable)
          .where(whereCondition)
          .limit(limit)
          .offset(offset)
          .orderBy(desc(releasesTable.createdAt)),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch releases: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'releases'
        })
    })

    return {
      data,
      pagination: createPaginationMetadata(total, limit, offset)
    }
  })

const getBySlugEffect = (slug: string) =>
  Effect.gen(function* () {
    const releaseRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(releasesTable)
          .where(and(eq(releasesTable.slug, slug), eq(releasesTable.draft, false)))
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

    let processedRelease: SelectMdxCompiledRelease = {
      ...release,
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

const createEffect = (data: InsertRelease & { releaseDate: Date }) =>
  Effect.gen(function* () {
    const labelRecords = yield* Effect.tryPromise({
      try: () => db.select().from(labelsTable).where(eq(labelsTable.id, data.labelId)).limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch label: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'labels'
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

    const insertedRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .insert(releasesTable)
          .values({
            ...data,
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

    return newRelease
  })

const updateEffect = (slug: string, data: Partial<InsertRelease> & { releaseDate?: Date }) =>
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

    const updatedRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .update(releasesTable)
          .set({
            ...data,
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

    const baseProcessedRelease: SelectMdxCompiledRelease = {
      ...updatedRelease,
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

const deleteEffect = (slug: string) =>
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

    yield* Effect.tryPromise({
      try: () => db.delete(releasesTable).where(eq(releasesTable.id, existingRelease.id)),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to delete release: ${getErrorMessage(error)}`,
          operation: 'delete',
          table: 'releases'
        })
    })
  })

export const ReleaseServiceLive = Layer.succeed(ReleaseService, {
  getByLabelSlug: (labelSlug, options) =>
    getByLabelSlugEffect(labelSlug, options).pipe(
      Effect.withSpan('release.getByLabelSlug', { attributes: { labelSlug } })
    ),
  getBySlug: (slug) =>
    getBySlugEffect(slug).pipe(Effect.withSpan('release.getBySlug', { attributes: { slug } })),
  create: (data) => createEffect(data).pipe(Effect.withSpan('release.create')),
  update: (slug, data) =>
    updateEffect(slug, data).pipe(Effect.withSpan('release.update', { attributes: { slug } })),
  delete: (slug) =>
    deleteEffect(slug).pipe(Effect.withSpan('release.delete', { attributes: { slug } }))
})
