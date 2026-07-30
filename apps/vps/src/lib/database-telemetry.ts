const DATABASE_TEXT_ATTRIBUTE_KEYS = [
  'db.statement',
  'db.query',
  'db.query.text',
  'db.query.parameters'
] as const
const DATABASE_TEXT_ATTRIBUTES = new Set<string>(DATABASE_TEXT_ATTRIBUTE_KEYS)

const SQL_OPERATION_PATTERN = /\b(select|insert|update|delete)\b/i
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

function unquoteIdentifier(identifier: string): string {
  const part = identifier.split('.').at(-1)?.trim() ?? ''
  return part.startsWith('"') && part.endsWith('"') ? part.slice(1, -1) : part
}

/**
 * Reduces SQL to low-cardinality fields that are safe to send to telemetry.
 *
 * Bind parameters, predicates, selected columns, and literal values are deliberately discarded.
 */
export function summarizeDatabaseQuery(query: string): DatabaseQuerySummary {
  const operation = query.match(SQL_OPERATION_PATTERN)?.[1]?.toUpperCase() ?? 'QUERY'
  const tableMatch = TABLE_PATTERNS[operation]?.exec(query)
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
  if (dbSystem === undefined) return span

  const rawQuery = DATABASE_TEXT_ATTRIBUTE_KEYS.flatMap((key) => {
    const value = span.data[key]
    return typeof value === 'string' ? [value] : []
  })[0]
  const summary = summarizeDatabaseQuery(rawQuery ?? span.description ?? '')
  const data: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(span.data)) {
    if (!DATABASE_TEXT_ATTRIBUTES.has(key)) {
      data[key] = value
    }
  }

  data['sentry.op'] = 'db.query'
  data['db.system.name'] = 'postgresql'
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
