# VPS API Pagination Pattern

This document outlines the standard pagination pattern for all GET list endpoints in the VPS API.

## Overview

All GET endpoints that return lists of resources MUST implement cursor-based or offset-based pagination to prevent performance issues and improve user experience.

## Pagination Strategy

We use **offset-based pagination** with limit/offset parameters, consistent with common REST API patterns.

### Why Offset-Based Pagination?

- **Simple to implement**: Works well with Drizzle ORM's `.limit()` and `.offset()` methods
- **Familiar pattern**: Most developers understand `limit` and `offset` parameters
- **Jump to page**: Allows direct access to any page (e.g., page 5)
- **Good for moderate datasets**: Our current data volumes make this approach suitable

**Trade-offs considered:**

- Cursor-based pagination is better for very large datasets or real-time data
- For future optimization, we could migrate to cursor-based pagination if needed

## Standard Query Parameters

All paginated GET endpoints accept these query parameters:

| Parameter | Type   | Default | Min | Max | Description                                               |
| --------- | ------ | ------- | --- | --- | --------------------------------------------------------- |
| `limit`   | number | 20      | 1   | 100 | Number of items to return per page                        |
| `offset`  | number | 0       | 0   | ∞   | Number of items to skip before starting to return results |

### Validation Rules

```typescript
const paginationQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0)
})
```

**Notes:**

- Use `z.coerce.number()` to handle query string conversion
- Max limit of 100 prevents excessive data transfer
- Default limit of 20 provides good balance for most use cases

## Standard Response Format

All paginated endpoints return a consistent structure:

```typescript
{
  data: T[],           // Array of resource items
  pagination: {
    total: number,     // Total count of items in database
    limit: number,     // Limit used for this request
    offset: number,    // Offset used for this request
    hasMore: boolean   // Whether more items exist beyond current page
  }
}
```

### Response Schema

```typescript
const paginatedResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    data: z.array(dataSchema),
    pagination: z.object({
      total: z.number(),
      limit: z.number(),
      offset: z.number(),
      hasMore: z.boolean()
    })
  })
```

## Implementation Pattern

### 1. Route Definition

```typescript
import { createRoute } from '@hono/zod-openapi'
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers'
import { createMessageObjectSchema } from 'stoker/openapi/schemas'
import { z } from 'zod'

// Shared pagination query schema
export const paginationQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0)
})

// Shared pagination metadata schema
export const paginationMetadataSchema = z.object({
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  hasMore: z.boolean()
})

// Helper to create paginated response schema
export const createPaginatedResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    data: z.array(dataSchema),
    pagination: paginationMetadataSchema
  })

// Example route definition
export const listPublications = createRoute({
  path: '/',
  method: 'get',
  request: {
    query: paginationQuerySchema
  },
  tags: ['Publication'],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      createPaginatedResponseSchema(publicationSchema),
      'List of publications with pagination'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema('Internal server error'),
      'Server error'
    )
  }
})
```

### 2. Handler Implementation with Drizzle ORM

```typescript
import { count } from 'drizzle-orm'
import type { AppRouteHandler } from '../../lib/types'

export const listPublications: AppRouteHandler<ListPublicationsRoute> = async (c) => {
  try {
    const { limit, offset } = c.req.valid('query')

    // Get total count
    const [{ total }] = await db.select({ total: count() }).from(publicationsTable)

    // Get paginated data
    const data = await db
      .select()
      .from(publicationsTable)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(publicationsTable.createdAt)) // Always specify order for consistent pagination

    // Calculate hasMore
    const hasMore = offset + limit < total

    return c.json(
      {
        data,
        pagination: {
          total,
          limit,
          offset,
          hasMore
        }
      },
      HttpStatusCodes.OK
    )
  } catch (error) {
    console.error('Error listing publications:', error)
    return c.json({ message: 'Failed to list publications' }, HttpStatusCodes.INTERNAL_SERVER_ERROR)
  }
}
```

### 3. With Filtering/Where Clauses

```typescript
export const getAudioByType: AppRouteHandler<GetAudioByTypeRoute> = async (c) => {
  try {
    const { type } = c.req.valid('param')
    const { limit, offset } = c.req.valid('query')

    // Build where condition
    const whereCondition = and(eq(audioTable.type, type), eq(audioTable.draft, false))

    // Get total count with filter
    const [{ total }] = await db.select({ total: count() }).from(audioTable).where(whereCondition)

    // Get paginated data with filter
    const data = await db
      .select()
      .from(audioTable)
      .where(whereCondition)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(audioTable.createdAt))

    const hasMore = offset + limit < total

    return c.json(
      {
        data,
        pagination: { total, limit, offset, hasMore }
      },
      HttpStatusCodes.OK
    )
  } catch (error) {
    console.error(`Error fetching ${type} audio:`, error)
    return c.json(
      { message: `Failed to fetch ${type} audio` },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}
```

### 4. With Joins

```typescript
export const getReleasesByLabel: AppRouteHandler<GetReleasesByLabelRoute> = async (c) => {
  try {
    const { labelSlug } = c.req.valid('param')
    const { limit, offset } = c.req.valid('query')

    // First, get the label to ensure it exists
    const label = await db
      .select()
      .from(labelsTable)
      .where(eq(labelsTable.slug, labelSlug))
      .limit(1)

    if (!label.length) {
      return c.json({ message: 'Label not found' }, HttpStatusCodes.NOT_FOUND)
    }

    // Build where condition for releases
    const whereCondition = eq(releasesTable.labelSlug, labelSlug)

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(releasesTable)
      .where(whereCondition)

    // Get paginated data
    const data = await db
      .select()
      .from(releasesTable)
      .where(whereCondition)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(releasesTable.createdAt))

    const hasMore = offset + limit < total

    return c.json(
      {
        data,
        pagination: { total, limit, offset, hasMore }
      },
      HttpStatusCodes.OK
    )
  } catch (error) {
    console.error('Error fetching releases:', error)
    return c.json({ message: 'Failed to fetch releases' }, HttpStatusCodes.INTERNAL_SERVER_ERROR)
  }
}
```

## Best Practices

### 1. Always Specify Order

```typescript
// ✅ GOOD: Consistent ordering
.orderBy(desc(table.createdAt))

// ❌ BAD: No ordering = unpredictable results across pages
.select().from(table).limit(10)
```

Without explicit ordering, database may return rows in any order, causing:

- Duplicate items across pages
- Missing items when paginating
- Inconsistent results

**Recommended ordering strategies:**

- **Time-based**: `desc(table.createdAt)` - newest first
- **Alphabetical**: `asc(table.name)` - A-Z sorting
- **Custom**: `desc(table.priority), desc(table.createdAt)` - multiple columns

### 2. Handle Empty Results Gracefully

```typescript
// Returns valid pagination even with 0 results
{
  data: [],
  pagination: {
    total: 0,
    limit: 20,
    offset: 0,
    hasMore: false
  }
}
```

### 3. Count Performance Optimization

For large tables, counting can be expensive. Consider:

```typescript
// Option 1: Exact count (current approach)
const [{ total }] = await db.select({ total: count() }).from(table)

// Option 2: Estimated count for very large tables (future optimization)
// Use PostgreSQL's reltuples for approximate count
// Only use when exact count isn't critical

// Option 3: Limit count queries
// If you only need to know "has more than X items", you can optimize:
const maxCount = 10000
const [{ total }] = await db.select({ total: count() }).from(table).limit(maxCount)
// Then cap total at maxCount in response
```

### 4. Validate Offset Bounds

```typescript
// If offset exceeds total, return empty array (not an error)
if (offset >= total && total > 0) {
  return c.json(
    {
      data: [],
      pagination: {
        total,
        limit,
        offset,
        hasMore: false
      }
    },
    HttpStatusCodes.OK
  )
}
```

### 5. Use Consistent Field Names

Always use `data` and `pagination` in responses:

- ✅ `{ data: [], pagination: {} }`
- ❌ `{ items: [], meta: {} }`
- ❌ `{ results: [], page_info: {} }`

### 6. Document in OpenAPI

Always include clear descriptions in route definitions:

```typescript
responses: {
  [HttpStatusCodes.OK]: jsonContent(
    createPaginatedResponseSchema(schema),
    'Paginated list of resources. Use limit and offset query parameters to navigate pages.'
  )
}
```

## Migration Checklist

When adding pagination to an existing endpoint:

- [ ] Update route definition to include `paginationQuerySchema` in `request.query`
- [ ] Update response schema to use `createPaginatedResponseSchema()`
- [ ] Update handler to extract `limit` and `offset` from validated query
- [ ] Add count query for total
- [ ] Add `.limit()` and `.offset()` to data query
- [ ] Add `.orderBy()` to ensure consistent ordering
- [ ] Calculate `hasMore` boolean
- [ ] Return new response format with `data` and `pagination`
- [ ] Update tests to verify pagination behavior
- [ ] Update API documentation/examples
- [ ] Consider backward compatibility (if needed)

## Backward Compatibility Considerations

### Breaking Change Notice

Changing from:

```typescript
// Before
GET /api/resource
Response: Resource[]
```

To:

```typescript
// After
GET /api/resource?limit=20&offset=0
Response: { data: Resource[], pagination: {...} }
```

This is a **breaking change** for API consumers.

### Migration Strategies

**Option 1: Version the API** (Recommended for public APIs)

```
/api/v1/resource -> old format
/api/v2/resource -> new format
```

**Option 2: Support both formats** (Add complexity)

```typescript
// Check if client requests pagination
const usePagination = 'limit' in c.req.query || 'offset' in c.req.query

if (usePagination) {
  return c.json({ data, pagination })
} else {
  return c.json(data) // Legacy format
}
```

**Option 3: Immediate breaking change** (Simplest, requires coordination)

- Update all endpoints at once
- Update all clients simultaneously
- Document migration guide

**Recommendation**: Since this is primarily an internal API (web/mobile apps), use **Option 3** and update all consumers as part of the same release.

## Frontend Integration Example

### React Query Hook

```typescript
import { useQuery } from '@tanstack/react-query'

interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

export function usePublications(limit = 20, offset = 0) {
  return useQuery({
    queryKey: ['publications', limit, offset],
    queryFn: async (): Promise<PaginatedResponse<Publication>> => {
      const response = await fetch(
        `/api/publication?limit=${limit}&offset=${offset}`
      )
      if (!response.ok) throw new Error('Failed to fetch publications')
      return response.json()
    }
  })
}

// Usage in component
function PublicationsList() {
  const [page, setPage] = useState(0)
  const limit = 20
  const offset = page * limit

  const { data, isLoading } = usePublications(limit, offset)

  return (
    <div>
      {data?.data.map(pub => <PublicationCard key={pub.id} {...pub} />)}

      <Pagination
        currentPage={page}
        totalPages={Math.ceil((data?.pagination.total ?? 0) / limit)}
        onPageChange={setPage}
        hasMore={data?.pagination.hasMore ?? false}
      />
    </div>
  )
}
```

## Endpoints Requiring Pagination

The following VPS endpoints currently return unbounded lists and MUST be paginated:

### High Priority (User-facing, likely to grow)

1. ✅ `GET /publication/` - List all publications
2. ✅ `GET /auth/users` - List all users
3. ✅ `GET /content/audio/{type}` - Get audio by type (mix, track, misc)
4. ✅ `GET /content/labels` - Get all labels
5. ✅ `GET /content/labels/{labelSlug}/releases` - Get releases for a label
6. ✅ `GET /content/tag/{tag}` - Get posts filtered by tag

### Medium Priority (Internal/utility)

7. `GET /rss.xml` - RSS feed (may want to limit to recent N items)

### Exempt (Single resource lookups)

- `GET /content/audio/{type}/{slug}` - Single item, no pagination needed
- `GET /content/labels/{slug}` - Single item, no pagination needed
- `GET /content/releases/{slug}` - Single item, no pagination needed
- `GET /publication/{id}` - Single item, no pagination needed
- `GET /auth/profile` - Single user, no pagination needed

## Testing Pagination

### Manual Testing Checklist

```bash
# Test 1: Default pagination
curl "http://localhost:3000/api/resource"
# Should return limit=20, offset=0

# Test 2: Custom limit
curl "http://localhost:3000/api/resource?limit=5"
# Should return 5 items

# Test 3: Custom offset
curl "http://localhost:3000/api/resource?offset=10"
# Should skip first 10 items

# Test 4: Combined
curl "http://localhost:3000/api/resource?limit=5&offset=10"
# Should return items 11-15

# Test 5: Max limit boundary
curl "http://localhost:3000/api/resource?limit=100"
# Should succeed with 100

curl "http://localhost:3000/api/resource?limit=101"
# Should fail validation (max is 100)

# Test 6: Offset beyond total
curl "http://localhost:3000/api/resource?offset=999999"
# Should return empty data array

# Test 7: Invalid parameters
curl "http://localhost:3000/api/resource?limit=-1"
# Should fail validation

curl "http://localhost:3000/api/resource?offset=-1"
# Should fail validation
```

### Automated Test Example

```typescript
import { describe, test, expect } from 'bun:test'

describe('GET /publication', () => {
  test('returns default pagination', async () => {
    const res = await app.request('/publication')
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json).toHaveProperty('data')
    expect(json).toHaveProperty('pagination')
    expect(json.pagination.limit).toBe(20)
    expect(json.pagination.offset).toBe(0)
    expect(json.pagination).toHaveProperty('total')
    expect(json.pagination).toHaveProperty('hasMore')
  })

  test('respects custom limit', async () => {
    const res = await app.request('/publication?limit=5')
    const json = await res.json()

    expect(json.data.length).toBeLessThanOrEqual(5)
    expect(json.pagination.limit).toBe(5)
  })

  test('respects offset', async () => {
    const res1 = await app.request('/publication?limit=1&offset=0')
    const res2 = await app.request('/publication?limit=1&offset=1')

    const json1 = await res1.json()
    const json2 = await res2.json()

    // Items should be different
    expect(json1.data[0]?.id).not.toBe(json2.data[0]?.id)
  })

  test('validates max limit', async () => {
    const res = await app.request('/publication?limit=101')
    expect(res.status).toBe(400) // Validation error
  })

  test('validates negative offset', async () => {
    const res = await app.request('/publication?offset=-1')
    expect(res.status).toBe(400)
  })

  test('hasMore is accurate', async () => {
    const res = await app.request('/publication?limit=1')
    const json = await res.json()

    const expectedHasMore = json.pagination.total > 1
    expect(json.pagination.hasMore).toBe(expectedHasMore)
  })
})
```

## Future Enhancements

### Cursor-Based Pagination (Future)

For real-time data or very large datasets, consider cursor-based pagination:

```typescript
// Request
GET /api/resource?limit=20&cursor=eyJpZCI6MTIzfQ==

// Response
{
  data: [...],
  pagination: {
    nextCursor: "eyJpZCI6MTQzfQ==",
    hasMore: true
  }
}

// Implementation
const cursor = decodeCursor(c.req.query('cursor'))
const data = await db
  .select()
  .from(table)
  .where(cursor ? gt(table.id, cursor.id) : undefined)
  .limit(limit)
  .orderBy(asc(table.id))
```

**Benefits:**

- Consistent pagination even with concurrent inserts/deletes
- Better performance on large datasets
- No "page drift" issues

**Trade-offs:**

- Cannot jump to arbitrary pages
- More complex implementation
- Less familiar to developers

### Keyset Pagination

For time-based queries (e.g., "posts after this timestamp"):

```typescript
GET /api/posts?after=2024-01-15T10:00:00Z&limit=20
```

### GraphQL-Style Connections

For richer pagination metadata:

```typescript
{
  edges: [
    { node: {...}, cursor: "..." }
  ],
  pageInfo: {
    hasNextPage: true,
    hasPreviousPage: false,
    startCursor: "...",
    endCursor: "..."
  }
}
```

## References

- [Drizzle ORM - Select](https://orm.drizzle.team/docs/select)
- [REST API Pagination Best Practices](https://www.moesif.com/blog/technical/api-design/REST-API-Design-Filtering-Sorting-and-Pagination/)
- [Hono Documentation](https://hono.dev/)
- [OpenAPI Specification](https://swagger.io/specification/)

---

**Document Version**: 1.0.0
**Last Updated**: 2025-11-23
**Maintained By**: VPS API Team
