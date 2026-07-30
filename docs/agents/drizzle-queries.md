# Drizzle query rules

## Relational queries must not take correlated subqueries

Relational queries (`db.query.*`) alias the base table:

```sql
from "shows" "showsTable"
```

An `exists()` built from a standalone `db.select()` renders its correlated
reference with the table's real name, not the alias:

```sql
exists (select "showId" from "show_creators"
        where "show_creators"."showId" = "shows"."id")
```

Once the table is aliased, `"shows"` is out of scope and Postgres rejects the
statement with `invalid reference to FROM-clause entry for table "shows"`.

This shipped to production in July 2026 and broke every public profile view for
a user with mixes. `tsc` cannot catch it: the builder calls are legal
TypeScript, and only the generated SQL is wrong.

**Rule:** a predicate passed to `db.query.*` must not contain a standalone
correlated subquery. Use an uncorrelated membership subquery, a declared
relation, or an explicit join.

```ts
// no: correlated, breaks under aliasing
exists(db.select().from(audioCreators).where(eq(audioCreators.audioId, audioTable.id)))

// yes: uncorrelated, alias-independent
inArray(audioTable.id, db.select({ id: audioCreators.audioId }).from(audioCreators))
```

Creator-membership predicates are centralized in `src/db/creator-membership.ts`
(`audioIdsForCreator`, `showIdsForCreator`, `postIdsForCreator`). Use those
rather than rebuilding the subquery per service.

Watch for a condition shared between a plain `db.select()` count and a
`db.query.*` list. Plain selects do not alias, so the count succeeds while the
list throws, and the bug looks intermittent.

## Generated SQL is a runtime artifact

Treat it like compiled output: test it by executing against real Postgres.
`src/db/relational-queries.smoke.test.ts` runs every `db.query.*` shape in the
codebase, including both branches of each visibility predicate. Add a case there
when you introduce a new relational query shape.

Avoid SQL string snapshots. Executing catches alias bugs, schema drift, dialect
behavior, and ORM upgrades; a snapshot only detects that the string changed.

## Authorization tests must prove exclusion

A visibility test that only asserts the actor's own row is returned would pass
against a query returning every row. Always create a second user's record and
assert it is absent, and cover the admin branch separately.
