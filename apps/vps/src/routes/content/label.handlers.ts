import { eq } from 'drizzle-orm'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { db } from '@/db'
import { usersTable } from '@/db/user.schema'
import {
  labelsTable,
  labelCreators,
  type SelectMdxCompiledLabel
} from '@/db/label.schema'
import { compileMDX, isMDXCompilationResult } from '@/lib/mdx'
import type { AppRouteHandler } from '@/lib/types'

import type {
  CreateLabelRoute,
  GetAllLabelsRoute,
  GetLabelBySlugRoute,
  UpdateLabelBySlugRoute
} from './label.routes'

export const createLabel: AppRouteHandler<CreateLabelRoute> = async (c) => {
  const { creatorIds, ...labelData } = c.req.valid('json')
  const user = c.get('user')

  let finalCreatorIds: string[] = creatorIds || []
  if (finalCreatorIds.length === 0) {
    finalCreatorIds = [user.id]
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [newLabel] = await tx
        .insert(labelsTable)
        .values(labelData)
        .returning()

      if (!newLabel) {
        throw new Error('Failed to create label')
      }

      await tx.insert(labelCreators).values(
        finalCreatorIds.map((creatorId: string) => ({
          labelId: newLabel.id,
          creatorId
        }))
      )

      return newLabel
    })

    return c.json(result, HttpStatusCodes.CREATED)
  } catch (error) {
    if (error instanceof Error && error.message.includes('unique constraint')) {
      return c.json(
        { error: 'Label with this slug already exists' },
        HttpStatusCodes.CONFLICT
      )
    }

    if (
      error instanceof Error &&
      error.message.includes('foreign key constraint')
    ) {
      return c.json(
        { error: 'You may have entered a non-existent author id' },
        HttpStatusCodes.CONFLICT
      )
    }

    return c.json(
      { error: `Failed to create label: ${error}` },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

export const getAllLabels: AppRouteHandler<GetAllLabelsRoute> = async (c) => {
  try {
    const labels = await db
      .select()
      .from(labelsTable)
      .where(eq(labelsTable.draft, false))
    return c.json(labels, HttpStatusCodes.OK)
  } catch (error) {
    console.error('Error fetching labels:', error)
    return c.json(
      { error: 'Failed to fetch labels' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

export const getLabelBySlug: AppRouteHandler<GetLabelBySlugRoute> = async (
  c
) => {
  const { slug } = c.req.valid('param')

  try {
    const [label] = await db
      .select()
      .from(labelsTable)
      .where(eq(labelsTable.slug, slug))
      .limit(1)

    if (!label) {
      return c.json({ error: 'Label not found' }, HttpStatusCodes.NOT_FOUND)
    }

    const creators = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        username: usersTable.username
      })
      .from(labelCreators)
      .innerJoin(usersTable, eq(labelCreators.creatorId, usersTable.id))
      .where(eq(labelCreators.labelId, label.id))

    let processedLabel: SelectMdxCompiledLabel = {
      ...label,
      compiledContent: '',
      creators: creators.map((creator) => ({
        id: creator.id,
        name: creator.name,
        username: creator.username || ''
      }))
    }

    if (label.content) {
      const mdxResult = await compileMDX(label.content)

      if (isMDXCompilationResult(mdxResult)) {
        processedLabel = {
          ...processedLabel,
          compiledContent: mdxResult.compiled
        }
      } else {
        console.warn('Failed to compile MDX for label:', slug, mdxResult.error)
      }
    }

    return c.json(processedLabel, HttpStatusCodes.OK)
  } catch (error) {
    console.error('Error fetching label by slug:', error)
    return c.json(
      { error: 'Failed to fetch label' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

export const updateLabelBySlug: AppRouteHandler<
  UpdateLabelBySlugRoute
> = async (c) => {
  const { slug } = c.req.valid('param')
  const updateData = c.req.valid('json')

  try {
    const [existingLabel] = await db
      .select()
      .from(labelsTable)
      .where(eq(labelsTable.slug, slug))
      .limit(1)

    if (!existingLabel) {
      return c.json({ error: 'Label not found' }, HttpStatusCodes.NOT_FOUND)
    }

    const authorship = await db
      .select()
      .from(labelCreators)
      .where(eq(labelCreators.labelId, existingLabel.id))
      .limit(1)

    if (authorship.length === 0) {
      return c.json(
        {
          error: 'Not authorized to edit this content'
        },
        HttpStatusCodes.UNAUTHORIZED
      )
    }

    const [updatedLabel] = await db
      .update(labelsTable)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(labelsTable.id, existingLabel.id))
      .returning()

    if (!updatedLabel) {
      return c.json(
        { error: 'Failed to update label' },
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      )
    }

    const creators = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        username: usersTable.username
      })
      .from(labelCreators)
      .innerJoin(usersTable, eq(labelCreators.creatorId, usersTable.id))
      .where(eq(labelCreators.labelId, updatedLabel.id))

    const baseProcessedLabel: SelectMdxCompiledLabel = {
      ...updatedLabel,
      compiledContent: '',
      creators: creators.map((creator) => ({
        id: creator.id,
        name: creator.name,
        username: creator.username || ''
      }))
    }

    if (updatedLabel.content) {
      const mdxResult = await compileMDX(updatedLabel.content)
      if (isMDXCompilationResult(mdxResult)) {
        const processedLabelWithCompiled: SelectMdxCompiledLabel = {
          ...baseProcessedLabel,
          compiledContent: mdxResult.compiled
        }
        return c.json(processedLabelWithCompiled, HttpStatusCodes.OK)
      }
    }

    return c.json(baseProcessedLabel, HttpStatusCodes.OK)
  } catch (error) {
    console.error('Error updating label:', error)
    return c.json(
      { error: 'Failed to update label' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}
