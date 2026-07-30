const DATABASE_QUERY_ATTRIBUTE_KEYS = ['db.statement', 'db.query', 'db.query.text'] as const
const SAFE_DATABASE_ATTRIBUTE_KEYS = new Set([
  'db.system',
  'db.system.name',
  'db.namespace',
  'db.name',
  'server.address',
  'server.port'
])
const TABLE_PATTERNS: Readonly<Record<string, RegExp>> = {
  SELECT: /\bfrom\s+((?:"[^"]+"|[\w$]+)(?:\s*\.\s*(?:"[^"]+"|[\w$]+))?)/i,
  INSERT: /\binsert\s+into\s+((?:"[^"]+"|[\w$]+)(?:\s*\.\s*(?:"[^"]+"|[\w$]+))?)/i,
  UPDATE: /\bupdate\s+((?:"[^"]+"|[\w$]+)(?:\s*\.\s*(?:"[^"]+"|[\w$]+))?)/i,
  DELETE: /\bdelete\s+from\s+((?:"[^"]+"|[\w$]+)(?:\s*\.\s*(?:"[^"]+"|[\w$]+))?)/i
}

type DatabaseSpan = {
  readonly data: Readonly<Record<string, unknown>>
  readonly description?: string
  readonly op?: string
}

export type DatabaseQuerySummary = {
  readonly operation: string
  readonly table: string
  readonly description: string
}

type SqlOperation = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'

function unquoteIdentifier(identifier: string): string {
  const part = identifier.split('.').at(-1)?.trim() ?? ''
  return part.startsWith('"') && part.endsWith('"') ? part.slice(1, -1) : part
}

function findTopLevelOperation(
  query: string
): { operation: SqlOperation; index: number } | undefined {
  let depth = 0

  for (let index = 0; index < query.length; index += 1) {
    const character = query[index]
    const nextCharacter = query[index + 1]

    if (character === '-' && nextCharacter === '-') {
      const lineEnd = query.indexOf('\n', index + 2)
      if (lineEnd === -1) return undefined
      index = lineEnd
      continue
    }

    if (character === '/' && nextCharacter === '*') {
      const commentEnd = query.indexOf('*/', index + 2)
      if (commentEnd === -1) return undefined
      index = commentEnd + 1
      continue
    }

    if (character === "'" || character === '"') {
      const quote = character
      for (index += 1; index < query.length; index += 1) {
        if (query[index] !== quote) continue
        if (query[index + 1] === quote) {
          index += 1
          continue
        }
        break
      }
      continue
    }

    if (character === '$') {
      const delimiter = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(query.slice(index))?.[0]
      if (delimiter) {
        const valueEnd = query.indexOf(delimiter, index + delimiter.length)
        if (valueEnd === -1) return undefined
        index = valueEnd + delimiter.length - 1
        continue
      }
    }

    if (character === '(') {
      depth += 1
      continue
    }
    if (character === ')') {
      depth = Math.max(0, depth - 1)
      continue
    }

    if (depth !== 0 || character === undefined || !/[A-Za-z]/.test(character)) continue

    const token = /^[A-Za-z]+/.exec(query.slice(index))?.[0]
    if (!token) continue

    const operation = token.toUpperCase()
    if (
      operation === 'SELECT' ||
      operation === 'INSERT' ||
      operation === 'UPDATE' ||
      operation === 'DELETE'
    ) {
      return { operation, index }
    }
    index += token.length - 1
  }

  return undefined
}

function extractQueryText(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value !== 'object' || value === null || !('text' in value)) return undefined
  return typeof value.text === 'string' ? value.text : undefined
}

/**
 * Reduces SQL to low-cardinality fields that are safe to send to telemetry.
 *
 * Bind parameters, predicates, selected columns, and literal values are deliberately discarded.
 */
export function summarizeDatabaseQuery(query: string): DatabaseQuerySummary {
  const match = findTopLevelOperation(query)
  const operation = match?.operation ?? 'QUERY'
  const operationQuery = match ? query.slice(match.index) : query
  const tableMatch = TABLE_PATTERNS[operation]?.exec(operationQuery)
  const table = tableMatch?.[1] ? unquoteIdentifier(tableMatch[1]) : 'unknown'

  return {
    operation,
    table,
    description: table === 'unknown' ? operation : `${operation} ${table}`
  }
}

/**
 * Removes raw SQL and parameters from a Sentry database span while preserving useful DB semantics.
 */
export function sanitizeDatabaseSpan<T extends DatabaseSpan>(span: T): T {
  const dbSystem = span.data['db.system.name'] ?? span.data['db.system']
  if (typeof dbSystem !== 'string') return span

  const rawQuery = DATABASE_QUERY_ATTRIBUTE_KEYS.flatMap((key) => {
    const query = extractQueryText(span.data[key])
    return query ? [query] : []
  })[0]
  const summary = summarizeDatabaseQuery(rawQuery ?? span.description ?? '')
  const data: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(span.data)) {
    if (SAFE_DATABASE_ATTRIBUTE_KEYS.has(key)) {
      data[key] = value
    }
  }

  data['sentry.op'] = 'db.query'
  data['db.system.name'] = dbSystem
  data['db.operation.name'] = summary.operation
  data['db.collection.name'] = summary.table
  data['db.query.summary'] = summary.description

  return {
    ...span,
    op: 'db.query',
    description: summary.description,
    data
  }
}
