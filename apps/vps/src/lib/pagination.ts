import { z } from 'zod'

/**
 * Standard pagination query parameters schema
 * Validates limit (1-100, default 20) and offset (min 0, default 0)
 */
export const paginationQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
})

/**
 * Pagination metadata schema for responses
 * Includes total count, limit, offset, and hasMore indicator
 */
export const paginationMetadataSchema = z.object({
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  hasMore: z.boolean(),
})

/**
 * Helper function to create a paginated response schema
 * Wraps any data schema in a consistent pagination structure
 *
 * @param dataSchema - Zod schema for the data array items
 * @returns Zod schema for paginated response
 *
 * @example
 * const publicationListSchema = createPaginatedResponseSchema(publicationSchema)
 */
export function createPaginatedResponseSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    data: z.array(dataSchema),
    pagination: paginationMetadataSchema,
  })
}

/**
 * Type inference helper for pagination query params
 */
export type PaginationQuery = z.infer<typeof paginationQuerySchema>

/**
 * Type inference helper for pagination metadata
 */
export type PaginationMetadata = z.infer<typeof paginationMetadataSchema>

/**
 * Type inference helper for paginated response
 */
export type PaginatedResponse<T> = {
  data: T[]
  pagination: PaginationMetadata
}

/**
 * Calculates whether more items exist beyond the current page
 *
 * @param total - Total number of items in database
 * @param offset - Current offset
 * @param limit - Current limit
 * @returns true if more items exist beyond current page
 *
 * @example
 * const hasMore = calculateHasMore(100, 20, 20) // true (items 40-99 remain)
 * const hasMore = calculateHasMore(100, 90, 20) // false (only 10 items remain)
 */
export function calculateHasMore(total: number, offset: number, limit: number): boolean {
  return offset + limit < total
}

/**
 * Creates pagination metadata object for response
 *
 * @param total - Total number of items in database
 * @param limit - Current limit
 * @param offset - Current offset
 * @returns Pagination metadata object
 *
 * @example
 * const pagination = createPaginationMetadata(100, 20, 0)
 * // { total: 100, limit: 20, offset: 0, hasMore: true }
 */
export function createPaginationMetadata(
  total: number,
  limit: number,
  offset: number,
): PaginationMetadata {
  return {
    total,
    limit,
    offset,
    hasMore: calculateHasMore(total, offset, limit),
  }
}
