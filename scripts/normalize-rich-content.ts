import { readFile, writeFile } from 'node:fs/promises'

import { Schema } from 'effect'

import { normalizeRichContent } from '../packages/rich-content/src/normalize'
import { parseRichContent } from '../packages/rich-content/src/source'

const ExportRecord = Schema.Struct({
  kind: Schema.String,
  id: Schema.String,
  content: Schema.NullOr(Schema.String),
})

const ExportFile = Schema.Array(ExportRecord)

const [inputPath, outputPath] = process.argv.slice(2)

if (!inputPath) {
  process.stderr.write(
    'Usage: bun scripts/normalize-rich-content.ts <export.json> [normalized.json]\n',
  )
  process.exit(2)
}

const records = Schema.decodeUnknownSync(ExportFile)(JSON.parse(await readFile(inputPath, 'utf8')))
const unresolved: Array<{ kind: string; id: string; reason: string }> = []
let changed = 0

const normalized = records.map((record) => {
  if (record.content === null || record.content.length === 0) return record
  const result = normalizeRichContent(record.content)

  for (const failure of result.unresolved)
    unresolved.push({ kind: record.kind, id: record.id, reason: failure.reason })

  const diagnostics = parseRichContent(result.source).diagnostics

  for (const diagnostic of diagnostics)
    unresolved.push({ kind: record.kind, id: record.id, reason: diagnostic.message })

  if (result.changed) changed++

  return { ...record, content: result.source }
})

const report = { records: records.length, changed, unresolved: unresolved.length }
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)

if (unresolved.length > 0) {
  process.stderr.write(`${JSON.stringify(unresolved, null, 2)}\n`)
  process.exit(1)
}

if (outputPath) await writeFile(outputPath, `${JSON.stringify(normalized, null, 2)}\n`)
