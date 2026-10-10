import { DatabaseSync } from 'node:sqlite'

import { expect, test } from 'vitest'

import { cloneMigrationByteLimit, cloneMigrations, pendingCloneMigrationName } from './clone-sql'

test('restores a large export in bounded batches without breaking quoted content or triggers', async () => {
  const rows = Array.from(
    { length: 200 },
    (_, index) => `INSERT INTO items VALUES (${index}, '${'☁'.repeat(1000)}; it''s\nmultiline');`,
  )

  const sql = [
    'CREATE TABLE items (id INTEGER PRIMARY KEY, content TEXT);',
    'CREATE TABLE audit (id INTEGER);',
    'CREATE TRIGGER track_insert AFTER INSERT ON items BEGIN\nINSERT INTO audit VALUES (new.id);\nEND;',
    ...rows,
    'CREATE UNIQUE INDEX audit_id_unique ON audit (id);',
  ].join('\n')

  expect(Buffer.byteLength(sql)).toBeGreaterThan(cloneMigrationByteLimit)
  const migrations = await cloneMigrations(sql)
  expect(migrations.length).toBeGreaterThan(1)
  using local = new DatabaseSync(':memory:')

  for (const migration of migrations) {
    expect(Buffer.byteLength(migration.sql)).toBeLessThan(cloneMigrationByteLimit)
    local.exec(migration.sql)
  }

  expect(local.prepare('SELECT count(*) AS count FROM items').get()).toEqual({ count: 200 })
  expect(local.prepare('SELECT count(*) AS count FROM audit').get()).toEqual({ count: 200 })
  expect(() => local.exec('INSERT INTO audit VALUES (0);')).toThrow('UNIQUE constraint failed')
  expect(local.prepare('SELECT content FROM items WHERE id = 0').get()).toEqual({
    content: `${'☁'.repeat(1000)}; it's\nmultiline`,
  })
  expect(Number.parseInt(pendingCloneMigrationName('0009_featured_mix.sql'), 10)).toBeGreaterThan(
    migrations.length,
  )
})

test('rejects a single SQL statement that cannot fit within the local restore limit', async () => {
  await expect(
    cloneMigrations(`SELECT '${'x'.repeat(cloneMigrationByteLimit)}';\n`),
  ).rejects.toThrow('single exported SQL statement')
})
