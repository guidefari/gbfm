import { count, desc, eq } from 'drizzle-orm'
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
  NotFoundError,
  UnauthorizedError
} from '@/errors'
import { compileMDX, isMDXCompilationResult } from '@/lib/mdx'
import {
  createPaginationMetadata,
  type PaginationMetadata
} from '@/lib/pagination'

export interface LabelService {
  readonly getAll: (options: {
    limit: number
    offset: number
  }) => Effect.Effect<
    { data: SelectLabel[]; pagination: PaginationMetadata },
    DatabaseError
  >
  readonly getBySlug: (
    slug: string
  ) => Effect.Effect<SelectMdxCompiledLabel, DatabaseError | NotFoundError>
  readonly create: (
    data: InsertLabel,
    creatorIds: string[]
  ) => Effect.Effect<SelectLabel, DatabaseError | ConflictError>
  readonly update: (
    slug: string,
    data: Partial<InsertLabel>
  ) => Effect.Effect<
    SelectMdxCompiledLabel,
    DatabaseError | NotFoundError | UnauthorizedError
  >
}

export const LabelService = Context.GenericTag<LabelService>('LabelService')

const getAllEffect = (options: { limit: number; offset: number }) =>
  Effect.gen(function* () {
    const { limit, offset } = options
    const whereCondition = eq(labelsTable.draft, false)

    const countResult = yield* Effect.tryPromise({
      try: () =>
        db.select({ total: count() }).from(labelsTable).where(whereCondition),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to count labels: ${(error as Error).message}`,
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
          message: `Failed to fetch labels: ${(error as Error).message}`,
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
    const labelRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(labelsTable)
          .where(eq(labelsTable.slug, slug))
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch label: ${(error as Error).message}`,
          operation: 'select',
          table: 'labels'
        })
    })

    const label = labelRecords[0]
    if (!label) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Label not found',
          resource: 'label',
          id: slug
        })
      )
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
          message: `Failed to fetch creators: ${(error as Error).message}`,
          operation: 'select',
          table: 'label_creators'
        })
    })

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
            message: `Failed to compile MDX: ${(error as Error).message}`,
            operation: 'mdx_compile',
            table: 'labels'
          })
      })

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
    const result = yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          const [newLabel] = await tx
            .insert(labelsTable)
            .values(data)
            .returning()

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
        const errorMessage = (error as Error).message
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

const updateEffect = (slug: string, data: Partial<InsertLabel>) =>
  Effect.gen(function* () {
    const existingRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(labelsTable)
          .where(eq(labelsTable.slug, slug))
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to check label existence: ${(error as Error).message}`,
          operation: 'select',
          table: 'labels'
        })
    })

    const existingLabel = existingRecords[0]
    if (!existingLabel) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Label not found',
          resource: 'label',
          id: slug
        })
      )
    }

    const authorship = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(labelCreators)
          .where(eq(labelCreators.labelId, existingLabel.id))
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to check authorship: ${(error as Error).message}`,
          operation: 'select',
          table: 'label_creators'
        })
    })

    if (authorship.length === 0) {
      return yield* Effect.fail(
        new UnauthorizedError({
          message: 'Not authorized to edit this content'
        })
      )
    }

    const updatedRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .update(labelsTable)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(labelsTable.id, existingLabel.id))
          .returning(),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to update label: ${(error as Error).message}`,
          operation: 'update',
          table: 'labels'
        })
    })

    const updatedLabel = updatedRecords[0]
    if (!updatedLabel) {
      return yield* Effect.fail(
        new DatabaseError({
          message: 'Failed to update label',
          operation: 'update',
          table: 'labels'
        })
      )
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
          message: `Failed to fetch creators: ${(error as Error).message}`,
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
            message: `Failed to compile MDX: ${(error as Error).message}`,
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

export const LabelServiceLive = Layer.succeed(LabelService, {
  getAll: getAllEffect,
  getBySlug: getBySlugEffect,
  create: createEffect,
  update: updateEffect
})
