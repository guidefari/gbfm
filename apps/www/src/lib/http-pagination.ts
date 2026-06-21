export type PaginationMetadata = {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export type PaginatedResponse<T> = {
  data: T[]
  pagination: PaginationMetadata
}

export type PaginationOptions = {
  limit?: number
}

export const DEFAULT_PAGE_SIZE = 5

export function setPaginationParams(
  url: URL,
  pageParam: number,
  { limit = DEFAULT_PAGE_SIZE }: PaginationOptions = {}
) {
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('offset', String(pageParam))
}

export function getNextOffsetPageParam<T>(lastPage: PaginatedResponse<T>) {
  return lastPage.pagination.hasMore
    ? lastPage.pagination.offset + lastPage.pagination.limit
    : undefined
}
