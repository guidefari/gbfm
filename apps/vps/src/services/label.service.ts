import { and, count, desc, eq } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { db } from '@/db'
import { user as usersTable } from '@/db/auth.schema'
import {
  type InsertLabel,
  labelCreators,
  labelsTable,
  type SelectLabel,
  type SelectMdxCompiledLabel
} from '@/db/label.schema'
import {
  ConflictError,
  DatabaseError,
  getErrorMessage,
  NotFoundError,
  type UnauthorizedError
} from '@/errors'
import { requireCreator } from '@/lib/authorization'
import { compileMDX, isMDXCompilationResult } from '@/lib/mdx'
import { createPaginationMetadata, type PaginationMetadata } from '@/lib/pagination'

export interface LabelService {
  readonly getAll: (options: {
    limit: number
    offset: number
  }) => Effect.Effect<{ data: SelectLabel[]; pagination: PaginationMetadata }, DatabaseError>
  readonly getBySlug: (
    slug: string
  ) => Effect.Effect<SelectMdxCompiledLabel, DatabaseError | NotFoundError>
  readonly create: (
    data: InsertLabel,
    creatorIds: string[]
  ) => Effect.Effect<SelectLabel, DatabaseError | ConflictError>
  readonly update: (
    slug: string,
    userId: string,
    data: Partial<InsertLabel>
  ) => Effect.Effect<SelectMdxCompiledLabel, DatabaseError | NotFoundError | UnauthorizedError>
}

export const LabelService = Context.Service<LabelService>('LabelService')

const getAllEffect = (options: { limit: number; offset: number }) =>
  Effect.gen(function* () {
    const { limit, offset } = options
    yield* Effect.annotateCurrentSpan('pagination.limit', limit)
    yield* Effect.annotateCurrentSpan('pagination.offset', offset)
    const whereCondition = eq(labelsTable.draft, false)

    const countResult = yield* Effect.tryPromise({
      try: () => db.select({ total: count() }).from(labelsTable).where(whereCondition),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to count labels: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'labels'
        })
    })

    const total = countResult[0]?.total ?? 0

    const data = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(labelsTable)
          .where(whereCondition)
          .limit(limit)
          .offset(offset)
          .orderBy(desc(labelsTable.createdAt)),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch labels: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'labels'
        })
    })

    return {
      data,
      pagination: createPaginationMetadata(total, limit, offset)
    }
  })

const getBySlugEffect = (slug: string) =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan('label.slug', slug)
    const labelRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(labelsTable)
          .where(and(eq(labelsTable.slug, slug), eq(labelsTable.draft, false)))
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch label: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'labels'
        })
    }).pipe(Effect.withSpan('label.getBySlug.selectLabel'))

    const label = labelRecords[0]
    if (!label) {
      return yield* new NotFoundError({
        message: 'Label not found',
        resource: 'label',
        id: slug
      })
    }

    const creators = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: usersTable.id,
            name: usersTable.name
          })
          .from(labelCreators)
          .innerJoin(usersTable, eq(labelCreators.creatorId, usersTable.id))
          .where(eq(labelCreators.labelId, label.id)),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch creators: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'label_creators'
        })
    }).pipe(Effect.withSpan('label.getBySlug.selectCreators'))

    let processedLabel: SelectMdxCompiledLabel = {
      ...label,
      compiledContent: '',
      creators: creators.map((creator) => ({
        id: creator.id,
        name: creator.name
      }))
    }

    if (label.content) {
      const mdxResult = yield* Effect.tryPromise({
        try: () => compileMDX(label.content),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to compile MDX: ${getErrorMessage(error)}`,
            operation: 'mdx_compile',
            table: 'labels'
          })
      }).pipe(Effect.withSpan('label.getBySlug.compileMdx'))

      if (isMDXCompilationResult(mdxResult)) {
        processedLabel = {
          ...processedLabel,
          compiledContent: mdxResult.compiled
        }
      }
    }

    return processedLabel
  })

const createEffect = (data: InsertLabel, creatorIds: string[]) =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan('label.slug', data.slug)
    yield* Effect.annotateCurrentSpan('creatorIds.count', creatorIds.length)
    const result = yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          const [newLabel] = await tx.insert(labelsTable).values(data).returning()

          if (!newLabel) {
            throw new Error('Failed to create label')
          }

          await tx.insert(labelCreators).values(
            creatorIds.map((creatorId) => ({
              labelId: newLabel.id,
              creatorId
            }))
          )

          return newLabel
        }),
      catch: (error) => {
        const errorMessage = getErrorMessage(error)
        if (errorMessage.includes('unique constraint')) {
          return new ConflictError({
            message: 'Label with this slug already exists',
            resource: 'label'
          })
        }
        if (errorMessage.includes('foreign key constraint')) {
          return new ConflictError({
            message: 'You may have entered a non-existent creator id',
            resource: 'label'
          })
        }
        return new DatabaseError({
          message: `Failed to create label: ${errorMessage}`,
          operation: 'transaction',
          table: 'labels'
        })
      }
    })

    return result
  })

const updateEffect = (slug: string, userId: string, data: Partial<InsertLabel>) =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan('label.slug', slug)
    yield* Effect.annotateCurrentSpan('fields.updated', Object.keys(data).join(','))
    const existingRecords = yield* Effect.tryPromise({
      try: () => db.select().from(labelsTable).where(eq(labelsTable.slug, slug)).limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to check label existence: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'labels'
        })
    })

    const existingLabel = existingRecords[0]
    if (!existingLabel) {
      return yield* new NotFoundError({
        message: 'Label not found',
        resource: 'label',
        id: slug
      })
    }

    yield* requireCreator('label', existingLabel.id, userId)

    const updatedRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .update(labelsTable)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(labelsTable.id, existingLabel.id))
          .returning(),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to update label: ${getErrorMessage(error)}`,
          operation: 'update',
          table: 'labels'
        })
    })

    const updatedLabel = updatedRecords[0]
    if (!updatedLabel) {
      return yield* new DatabaseError({
        message: 'Failed to update label',
        operation: 'update',
        table: 'labels'
      })
    }

    const creators = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: usersTable.id,
            name: usersTable.name
          })
          .from(labelCreators)
          .innerJoin(usersTable, eq(labelCreators.creatorId, usersTable.id))
          .where(eq(labelCreators.labelId, updatedLabel.id)),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch creators: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'label_creators'
        })
    })

    const baseProcessedLabel: SelectMdxCompiledLabel = {
      ...updatedLabel,
      compiledContent: '',
      creators: creators.map((creator) => ({
        id: creator.id,
        name: creator.name
      }))
    }

    if (updatedLabel.content) {
      const mdxResult = yield* Effect.tryPromise({
        try: () => compileMDX(updatedLabel.content),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to compile MDX: ${getErrorMessage(error)}`,
            operation: 'mdx_compile',
            table: 'labels'
          })
      })

      if (isMDXCompilationResult(mdxResult)) {
        return {
          ...baseProcessedLabel,
          compiledContent: mdxResult.compiled
        }
      }
    }

    return baseProcessedLabel
  })

// Wrapped effects with spans
const getAllWithSpan = (options: { limit: number; offset: number }) =>
  getAllEffect(options).pipe(Effect.withSpan('label.getAll'))

const getBySlugWithSpan = (slug: string) =>
  getBySlugEffect(slug).pipe(Effect.withSpan('label.getBySlug'))

const createWithSpan = (data: InsertLabel, creatorIds: string[]) =>
  createEffect(data, creatorIds).pipe(Effect.withSpan('label.create'))

const updateWithSpan = (slug: string, userId: string, data: Partial<InsertLabel>) =>
  updateEffect(slug, userId, data).pipe(Effect.withSpan('label.update'))

export const LabelServiceLive = Layer.succeed(LabelService, {
  getAll: getAllWithSpan,
  getBySlug: getBySlugWithSpan,
  create: createWithSpan,
  update: updateWithSpan
})
