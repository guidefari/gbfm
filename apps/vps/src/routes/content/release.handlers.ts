import { eq } from 'drizzle-orm'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { db } from '@/db'
import { labelsTable } from '@/db/label.schema'
import {
  releasesTable,
  type SelectMdxCompiledRelease
} from '@/db/release.schema'
import { compileMDX, isMDXCompilationResult } from '@/lib/mdx'
import type { AppRouteHandler } from '@/lib/types'

import type {
  CreateReleaseRoute,
  DeleteReleaseBySlugRoute,
  GetReleaseBySlugRoute,
  GetReleasesByLabelRoute,
  UpdateReleaseBySlugRoute
} from './release.routes'

export const createRelease: AppRouteHandler<CreateReleaseRoute> = async (c) => {
  const releaseData = c.req.valid('json')

  try {
    const [label] = await db
      .select()
      .from(labelsTable)
      .where(eq(labelsTable.id, releaseData.labelId))
      .limit(1)

    if (!label) {
      return c.json({ error: 'Label not found' }, HttpStatusCodes.NOT_FOUND)
    }

    console.log({ label })

    const [newRelease] = await db
      .insert(releasesTable)
      .values({
        ...releaseData,
        releaseDate: new Date(releaseData.releaseDate)
      })
      .returning()

    console.log('newRelease:', newRelease)

    if (!newRelease) {
      return c.json(
        { error: 'Failed to create release' },
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      )
    }

    return c.json(newRelease, HttpStatusCodes.CREATED)
  } catch (error) {
    console.error(error)

    if (error instanceof Error && error.message.includes('unique constraint')) {
      return c.json(
        { error: 'Release with this slug already exists' },
        HttpStatusCodes.CONFLICT
      )
    }

    return c.json(
      { error: `Failed to create release: ${error}` },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

export const getReleasesByLabel: AppRouteHandler<
  GetReleasesByLabelRoute
> = async (c) => {
  const { labelSlug } = c.req.valid('param')

  try {
    const [label] = await db
      .select()
      .from(labelsTable)
      .where(eq(labelsTable.slug, labelSlug))
      .limit(1)

    if (!label) {
      return c.json({ error: 'Label not found' }, HttpStatusCodes.NOT_FOUND)
    }

    const releases = await db
      .select()
      .from(releasesTable)
      .where(eq(releasesTable.labelId, label.id))

    return c.json(releases, HttpStatusCodes.OK)
  } catch (error) {
    console.error('Error fetching releases by label:', error)
    return c.json(
      { error: 'Failed to fetch releases' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

export const getReleaseBySlug: AppRouteHandler<GetReleaseBySlugRoute> = async (
  c
) => {
  const { slug } = c.req.valid('param')

  try {
    const [release] = await db
      .select()
      .from(releasesTable)
      .where(eq(releasesTable.slug, slug))
      .limit(1)

    if (!release) {
      return c.json({ error: 'Release not found' }, HttpStatusCodes.NOT_FOUND)
    }

    let processedRelease: SelectMdxCompiledRelease = {
      ...release,
      compiledContent: ''
    }

    if (release.content) {
      const mdxResult = await compileMDX(release.content)

      if (isMDXCompilationResult(mdxResult)) {
        processedRelease = {
          ...processedRelease,
          compiledContent: mdxResult.compiled
        }
      } else {
        console.warn(
          'Failed to compile MDX for release:',
          slug,
          mdxResult.error
        )
      }
    }

    return c.json(processedRelease, HttpStatusCodes.OK)
  } catch (error) {
    console.error('Error fetching release by slug:', error)
    return c.json(
      { error: 'Failed to fetch release' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

export const updateReleaseBySlug: AppRouteHandler<
  UpdateReleaseBySlugRoute
> = async (c) => {
  const { slug } = c.req.valid('param')
  const updateData = c.req.valid('json')

  try {
    const [existingRelease] = await db
      .select()
      .from(releasesTable)
      .where(eq(releasesTable.slug, slug))
      .limit(1)

    if (!existingRelease) {
      return c.json({ error: 'Release not found' }, HttpStatusCodes.NOT_FOUND)
    }

    const [updatedRelease] = await db
      .update(releasesTable)
      .set({
        ...updateData,
        updatedAt: new Date(),
        releaseDate: updateData.releaseDate
          ? new Date(updateData.releaseDate)
          : existingRelease.releaseDate
      })
      .where(eq(releasesTable.id, existingRelease.id))
      .returning()

    if (!updatedRelease) {
      return c.json(
        { error: 'Failed to update release' },
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      )
    }

    const baseProcessedRelease: SelectMdxCompiledRelease = {
      ...updatedRelease,
      compiledContent: ''
    }

    if (updatedRelease.content) {
      const mdxResult = await compileMDX(updatedRelease.content)
      if (isMDXCompilationResult(mdxResult)) {
        const processedReleaseWithCompiled: SelectMdxCompiledRelease = {
          ...baseProcessedRelease,
          compiledContent: mdxResult.compiled
        }
        return c.json(processedReleaseWithCompiled, HttpStatusCodes.OK)
      }
    }

    return c.json(baseProcessedRelease, HttpStatusCodes.OK)
  } catch (error) {
    console.error('Error updating release:', error)
    return c.json(
      { error: 'Failed to update release' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

export const deleteReleaseBySlug: AppRouteHandler<
  DeleteReleaseBySlugRoute
> = async (c) => {
  const { slug } = c.req.valid('param')

  try {
    const [existingRelease] = await db
      .select()
      .from(releasesTable)
      .where(eq(releasesTable.slug, slug))
      .limit(1)

    if (!existingRelease) {
      return c.json({ error: 'Release not found' }, HttpStatusCodes.NOT_FOUND)
    }

    await db
      .delete(releasesTable)
      .where(eq(releasesTable.id, existingRelease.id))

    return c.json(
      { message: 'Release deleted successfully' },
      HttpStatusCodes.OK
    )
  } catch (error) {
    console.error('Error deleting release:', error)
    return c.json(
      { error: 'Failed to delete release' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}
