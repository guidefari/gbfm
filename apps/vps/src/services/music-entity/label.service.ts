import { and, desc, eq, lte } from 'drizzle-orm'
import { Effect } from 'effect'
import { databaseClient as DbType } from '@/db/layer'
import { user as usersTable } from '@/db/auth.schema'
import {
  musicLabelCreatorsTable,
  musicLabelsTable,
  type SelectMdxCompiledMusicLabel,
  type SelectMusicLabel
} from '@/db/music-entity.schema'
import { DatabaseError, getErrorMessage } from '@/errors'
import { compileMDX, isMDXCompilationResult } from '@/lib/mdx'
import { toSlug } from '@/services/to-slug'
import { deleteLinksForEntityTx, requireInserted, requireOne } from './shared'

export interface CreateLabelInput {
  name: string
  description?: string | null
  imageUrl?: string | null
  bannerImageUrl?: string | null
  slug: string
  content: string
  tags?: string[] | null
  genres?: string[] | null
  publishedAt?: Date | null
  createdById?: string | null
}

export const createLabelEffect = (db: typeof DbType) =>
  Effect.fn('musicEntity.createLabel')(function* (data: CreateLabelInput) {
    const rows = yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          const inserted = await tx.insert(musicLabelsTable).values(data).returning()
          const label = inserted[0]
          if (label && data.createdById) {
            await tx
              .insert(musicLabelCreatorsTable)
              .values({ labelId: label.id, creatorId: data.createdById })
          }
          return inserted
        }),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to create label: ${getErrorMessage(error)}`,
          operation: 'insert',
          table: 'music_labels'
        })
    })
    return yield* requireInserted(rows, 'music_labels')
  })

export const getLabelsEffect = (db: typeof DbType) => (includeDrafts: boolean) =>
  Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(musicLabelsTable)
        .where(includeDrafts ? undefined : lte(musicLabelsTable.publishedAt, new Date()))
        .orderBy(desc(musicLabelsTable.createdAt)),
    catch: (error) =>
      new DatabaseError({
        message: `Failed to list labels: ${getErrorMessage(error)}`,
        operation: 'select',
        table: 'music_labels'
      })
  }).pipe(Effect.withSpan('musicEntity.getLabels'))

export const getLabelByIdEffect = (db: typeof DbType) => (id: string) =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: () => db.select().from(musicLabelsTable).where(eq(musicLabelsTable.id, id)).limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to get label: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'music_labels'
        })
    })
    return yield* requireOne(rows, 'MusicLabel', id)
  }).pipe(Effect.withSpan('musicEntity.getLabelById', { attributes: { id } }))

export const getLabelBySlugEffect = (db: typeof DbType) => (slug: string) =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(musicLabelsTable)
          .where(
            and(eq(musicLabelsTable.slug, slug), lte(musicLabelsTable.publishedAt, new Date()))
          )
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to get label: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'music_labels'
        })
    })
    const label = yield* requireOne(rows, 'MusicLabel', slug)
    const creators = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ id: usersTable.id, name: usersTable.name })
          .from(musicLabelCreatorsTable)
          .innerJoin(usersTable, eq(musicLabelCreatorsTable.creatorId, usersTable.id))
          .where(eq(musicLabelCreatorsTable.labelId, label.id)),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to get label creators: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'music_label_creators'
        })
    })

    let compiledContent = ''
    if (label.content) {
      const result = yield* Effect.tryPromise({
        try: () => compileMDX(label.content),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to compile label MDX: ${getErrorMessage(error)}`,
            operation: 'mdx_compile',
            table: 'music_labels'
          })
      })
      if (isMDXCompilationResult(result)) compiledContent = result.compiled
    }

    return { ...label, compiledContent, creators } satisfies SelectMdxCompiledMusicLabel
  }).pipe(Effect.withSpan('musicEntity.getLabelBySlug', { attributes: { slug } }))

export const updateLabelEffect =
  (db: typeof DbType) => (id: string, data: Partial<CreateLabelInput>) =>
    Effect.gen(function* () {
      const updateData = { ...data }
      if (updateData.name && !updateData.slug) updateData.slug = toSlug(updateData.name)
      const rows = yield* Effect.tryPromise({
        try: () =>
          db
            .update(musicLabelsTable)
            .set({ ...updateData, updatedAt: new Date() })
            .where(eq(musicLabelsTable.id, id))
            .returning(),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to update label: ${getErrorMessage(error)}`,
            operation: 'update',
            table: 'music_labels'
          })
      })
      return yield* requireOne(rows, 'MusicLabel', id)
    }).pipe(Effect.withSpan('musicEntity.updateLabel', { attributes: { id } }))

export const deleteLabelEffect = (db: typeof DbType) => (id: string) =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          await deleteLinksForEntityTx(tx, 'label', id)
          return tx
            .delete(musicLabelsTable)
            .where(eq(musicLabelsTable.id, id))
            .returning({ id: musicLabelsTable.id })
        }),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to delete label: ${getErrorMessage(error)}`,
          operation: 'delete',
          table: 'music_labels'
        })
    })
    yield* requireOne(rows, 'MusicLabel', id)
  }).pipe(Effect.withSpan('musicEntity.deleteLabel', { attributes: { id } }))

export type { SelectMusicLabel }
