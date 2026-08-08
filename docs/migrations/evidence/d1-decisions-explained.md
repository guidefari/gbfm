# Two D1 migration decisions, explained

Written to be read later, on your own. Each section states the problem, why it
was genuinely a decision rather than an obvious call, what was chosen, and the
general lesson worth keeping.

Both decisions are now recorded in `docs/migrations/postgres-to-d1.md`. This file
exists to explain the reasoning, not to be the source of truth.

---

## 1. Postgres arrays have no SQLite equivalent

### The problem

Postgres has a real array type. The schema used it in seven places:

```ts
tags: varchar({ length: 255 }).array()
artistNames: varchar({ length: 255 }).array()
genres: varchar({ length: 255 }).array()
```

SQLite, and therefore D1, has no array type at all. Every one of those columns
needs a new shape, and the shape you pick determines whether querying them stays
possible.

Postgres also let you query inside those arrays:

```sql
EXISTS (SELECT 1 FROM unnest(tags) AS t WHERE t ILIKE '%house%')
```

`unnest` explodes an array into rows so you can filter it. SQLite has no
`unnest`. That single missing function is what forces the decision: it is not
just "where do I put the strings", it is "can I still search them".

There were also two GIN indexes (`audio_tags_gin_idx`, `posts_tags_gin_idx`).
GIN is a Postgres index type built for looking *inside* composite values like
arrays. SQLite has nothing equivalent, so those indexes cannot be translated
either, only replaced.

### The three options

**Store as JSON text and scan with LIKE.** Cheapest to write. But
`LIKE '%house%'` on a JSON blob cannot use an index, so every tag search becomes
a full table scan, and it produces false positives: searching for the tag `house`
matches a post tagged `warehouse`.

**Normalize into join tables.** The classic relational answer: a `tags` table
and a `post_tags` link table. Tag search becomes an indexed join. Costs a schema
change and a data migration.

**Keep JSON but add a separate search index.** Extra machinery, two structures to
keep in sync, no benefit over normalizing here.

### What was chosen, and the part that matters

`tags` and `genres` were normalized into join tables. `artistNames` was **not** —
it stays a JSON text column.

That split is the interesting part, because at first glance all seven columns
look identical. They are not, and the difference only shows up in how the code
uses them:

```ts
// playlist-tracks.service.ts:481 — order is load-bearing
toSlug(`${t.artistNames.join(' ')} ${t.title}`)

// TweetMusicEntityCard.tsx:186 — order is load-bearing
artistName: artistNames?.join(', ') || 'Unknown artist'
```

Three reasons `artistNames` is different:

1. **Order is data.** Those `.join()` calls mean "Tom Misch & Yussef Dayes" must
   not become "Yussef Dayes & Tom Misch". The join table
   (`music_track_artists`) has no ordering column, so deriving the array from it
   would return arbitrary order and silently change slugs that already exist in
   URLs.
2. **It is a snapshot, not a cache.** It records who was credited on that
   release. If an artist later changes their name, historical credits should not
   silently rewrite themselves.
3. **It is never queried as a set.** Nothing does the equivalent of "find every
   track by this artist" through the array — that goes through the join table,
   which is exactly what it is for.

Tags are the opposite on all three counts: unordered, queried constantly, and
having no meaning beyond "this label applies".

### The lesson

**Denormalized is not the same as redundant.** The spec originally called
`artistNames` "a third representation" and flagged it for deletion. Reading the
call sites showed the two structures record different facts: the join table is
*which artist entities are linked*, the array is *how the credit reads on this
release*. They coincide most of the time, which is what makes the mistake easy.

The general test, worth applying next time you meet a suspicious duplicate:

- Is it ever **queried**, or only **displayed**? Queried duplicates should be
  normalized. Display-only ones often should not.
- Does it carry information the "canonical" source **cannot express**? Order,
  historical state, and formatting are the usual answers. If yes, it is not a
  cache and deriving it loses data.
- How many writers does it have? One writer (here,
  `scrape.service.ts:117-120`, which sets both from a single call) means drift
  risk is low and the usual argument against denormalizing gets much weaker.

---

## 2. SQLite full-text search changes what "matching" means

### The problem

Search currently uses `ILIKE`, Postgres's case-insensitive `LIKE`:

```sql
WHERE title ILIKE '%house%'
```

The `%` on both sides means "match anywhere in the string" — an *infix* match.
`house` finds `Deep House`, `Housework`, and `Warehouse`.

SQLite has no `ILIKE`, and more importantly, `LIKE '%term%'` cannot use an index,
so it degrades to a full scan of every row. The replacement is FTS5, SQLite's
built-in full-text search: a virtual table holding a search index, kept in sync
by triggers.

### The catch nobody expects

FTS5 does not search substrings. It splits text into **tokens** (roughly, words)
and matches whole tokens or token *prefixes*.

| Query | `ILIKE '%goo%'` today | FTS5 default tokenizer |
| --- | --- | --- |
| `goo` vs "Goosebumps" | matches | matches (prefix) |
| `goo` vs "Algood" | matches | **no match** |
| `bump` vs "Goosebumps" | matches | **no match** |

Prefix matching is not substring matching. Anything mid-word stops matching. This
is a silent, user-visible behavior change that no type checker or unit test would
catch — the code compiles, the query runs, it just quietly returns less.

FTS5 offers an alternative tokenizer, `trigram`, which indexes every
3-character sequence and therefore *does* match substrings, at the cost of a
larger index, a 3-character minimum, and worse relevance ranking.

### What decided it

Not database theory. The UI:

```tsx
// GlobalSearchDialog.tsx:23
const showResults = query.trim().length > 0
```

The global search is a command palette that fires on the **first keystroke**, no
debounce, no minimum length. With the default tokenizer, typing `g`, `go`, `goo`
returns nothing useful until you finish a word. Every search would look broken
for its first few characters.

So: **trigram**. It preserves exactly the behavior users have today, which also
means the search fixture captured in M1 stays a valid pass/fail test instead of
something to renegotiate mid-migration.

Queries of 1-2 characters fall back to `LIKE`, since trigram needs 3.

### The lesson

**When replacing an engine, the interesting question is what "equal" means, not
what is fastest.** Both tokenizers are correct full-text search. They disagree
about which strings match, and that disagreement is a product decision that the
database documentation cannot make for you.

Two habits worth keeping:

- **Capture current behavior as a fixture before changing the engine.** M1
  records real queries and their current results specifically so the replacement
  can be judged against reality rather than against someone's memory of how
  search felt. Do this before, not after; afterwards you have nothing to compare
  to.
- **Let the consumer decide the semantics.** The tokenizer question is unanswerable
  in the abstract. It became obvious the moment the search *UI* was read: a
  type-ahead palette needs incremental matching, whereas a "press enter to
  search" results page would happily take the default tokenizer and its better
  ranking.

Reconsider trigram only if relevance ranking becomes a requirement. It ranks
worse than the default, which matters for large corpora and does not matter for a
palette returning a handful of rows per group.

---

## Where this is recorded

- `docs/migrations/postgres-to-d1.md` — "Tags: array column to join table" and
  "Tokenizer: trigram, not the default"
- Linear OPS-247 (M3) implements both
- The M1 search fixture in `docs/migrations/evidence/` is the acceptance test for
  the tokenizer choice
