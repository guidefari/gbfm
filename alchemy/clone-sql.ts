import { execFile } from 'node:child_process'
import { fileURLToPath, URL } from 'node:url'

import { Schema } from 'effect'

const Statements = Schema.Array(Schema.String)

export const cloneMigrationByteLimit = 80_000

export const cloneMigrations = async (sql: string) => {
  const stdout = await new Promise<string>((resolve, reject) => {
    const child = execFile(
      'python3',
      [fileURLToPath(new URL('./split-sql.py', import.meta.url))],
      { maxBuffer: Buffer.byteLength(sql) * 6 + 1024 },
      (error, stdout) => {
        if (error)
          reject(new Error('Could not split the database export into complete SQL statements'))
        else resolve(stdout)
      },
    )

    child.stdin?.end(sql)
  })

  const statements = Schema.decodeUnknownSync(Statements)(JSON.parse(stdout))
  const chunks: Array<string> = []
  let chunk = ''

  for (const statement of statements) {
    if (Buffer.byteLength(statement) >= cloneMigrationByteLimit) {
      throw new Error('A single exported SQL statement exceeds the local restore limit')
    }

    if (Buffer.byteLength(chunk) + Buffer.byteLength(statement) + 1 >= cloneMigrationByteLimit) {
      chunks.push(chunk)
      chunk = ''
    }

    chunk += `${statement}\n`
  }

  if (chunk) chunks.push(chunk)

  return chunks.map((sql, index) => ({
    name: `${String(index).padStart(8, '0')}_production_clone.sql`,
    sql,
  }))
}

export const pendingCloneMigrationName = (file: string) => {
  const prefix = Number.parseInt(file.split('_')[0] ?? '', 10)

  if (!Number.isSafeInteger(prefix) || prefix < 0)
    throw new Error('Migration must have a numeric prefix')

  return `${1_000_000_000 + prefix}_${file}`
}
