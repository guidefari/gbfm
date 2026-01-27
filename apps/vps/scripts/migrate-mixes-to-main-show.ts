import { Effect, Layer, Context, Console, Data } from "effect";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import { audioTable } from "../src/db/audio.schema";
import { showsTable } from "../src/db/show.schema";

// Error types
class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly cause: unknown;
}> {}

class MigrationError extends Data.TaggedError("MigrationError")<{
  readonly operation: string;
  readonly cause: unknown;
}> {}

// Database service tag
class DatabaseService extends Context.Tag("DatabaseService")<
  DatabaseService,
  {
    readonly findMainShow: (
      slug: string,
    ) => Effect.Effect<
      typeof showsTable.$inferSelect | null,
      DatabaseError,
      never
    >;
    readonly createMainShow: (
      showData: typeof showsTable.$inferInsert,
    ) => Effect.Effect<typeof showsTable.$inferSelect, DatabaseError, never>;
    readonly findMixesWithoutShow: () => Effect.Effect<
      Array<typeof audioTable.$inferSelect>,
      DatabaseError,
      never
    >;
    readonly updateMixWithShow: (
      mixId: string,
      showId: string,
    ) => Effect.Effect<void, DatabaseError, never>;
  }
>() {}

// Database service implementation
const DatabaseServiceLive = Layer.effect(
  DatabaseService,
  Effect.gen(function* () {
    if (!process.env.PROD_DB_URL) {
      console.log(process.env);

      return yield* new DatabaseError({
        cause: "PROD_DB_URL environment variable is required",
      });
    }

    const pool = new Pool({
      connectionString: process.env.PROD_DB_URL,
    });

    const db = drizzle(pool);

    return {
      findMainShow: (slug) =>
        Effect.tryPromise({
          try: () =>
            db
              .select()
              .from(showsTable)
              .where(eq(showsTable.slug, slug))
              .limit(1)
              .then((results) => results[0] || null),
          catch: (cause) => new DatabaseError({ cause }),
        }),

      createMainShow: (showData) =>
        Effect.tryPromise({
          try: () =>
            db
              .insert(showsTable)
              .values(showData)
              .returning()
              .then((results) => {
                const result = results[0];
                if (!result) {
                  throw new Error("Failed to create show");
                }
                return result;
              }),
          catch: (cause) => new DatabaseError({ cause }),
        }),

      findMixesWithoutShow: () =>
        Effect.tryPromise({
          try: () =>
            db.select().from(audioTable).where(eq(audioTable.type, "mix")),
          catch: (cause) => new DatabaseError({ cause }),
        }),

      updateMixWithShow: (mixId, showId) =>
        Effect.tryPromise({
          try: () =>
            db
              .update(audioTable)
              .set({
                showId,
                updatedAt: new Date(),
              })
              .where(eq(audioTable.id, mixId)),
          catch: (cause) => new DatabaseError({ cause }),
        }),
    };
  }),
);

// Migration service tag
class MigrationService extends Context.Tag("MigrationService")<
  MigrationService,
  {
    readonly migrateMixesToMainShow: () => Effect.Effect<
      { migrated: number; errors: number; total: number },
      MigrationError,
      DatabaseService
    >;
  }
>() {}

// Migration service implementation
const MigrationServiceLive = Layer.effect(
  MigrationService,
  Effect.gen(function* () {
    return {
      migrateMixesToMainShow: () =>
        Effect.gen(function* () {
          const db = yield* DatabaseService;

          // Find or create main show
          const mainShowSlug = "main";
          let mainShow = yield* db.findMainShow(mainShowSlug);

          if (!mainShow) {
            yield* Console.log("Main show not found, creating it...");
            mainShow = yield* db.createMainShow({
              title: "Main Show",
              slug: "main",
              content: "The main show featuring all DJ mixes.",
              draft: false,
            });
            yield* Console.log(
              `Created main show: ${mainShow.title} (${mainShow.id})`,
            );
          } else {
            yield* Console.log(
              `Found main show: ${mainShow.title} (${mainShow.id})`,
            );
          }

          // Find mixes to migrate
          const mixesToMigrate = yield* db.findMixesWithoutShow();

          if (mixesToMigrate.length === 0) {
            yield* Console.log("No mixes found to migrate");
            return { migrated: 0, errors: 0, total: 0 };
          }

          yield* Console.log(`Found ${mixesToMigrate.length} mixes to migrate`);

          // Migrate each mix
          let migrated = 0;
          let errors = 0;

          for (const mix of mixesToMigrate) {
            const result = yield* Effect.either(
              db
                .updateMixWithShow(mix.id, mainShow.id)
                .pipe(
                  Effect.andThen(
                    Console.log(`✅ Migrated mix: ${mix.title || mix.slug}`),
                  ),
                ),
            );

            if (result._tag === "Right") {
              migrated++;
            } else {
              const error = result.left as DatabaseError;
              yield* Console.error(
                `❌ Error migrating mix ${mix.id}:`,
                error.cause,
              );
              errors++;
            }
          }

          const summary = { migrated, errors, total: mixesToMigrate.length };

          yield* Console.log("\n📊 Migration Summary:");
          yield* Console.log(`  Migrated: ${summary.migrated}`);
          yield* Console.log(`  Errors: ${summary.errors}`);
          yield* Console.log(`  Total: ${summary.total}`);

          return summary;
        }).pipe(
          Effect.mapError(
            (cause) =>
              new MigrationError({
                operation: "migrateMixesToMainShow",
                cause,
              }),
          ),
        ),
    };
  }),
);

// Main program
const program = Effect.gen(function* () {
  const migration = yield* MigrationService;
  return yield* migration.migrateMixesToMainShow();
});

// Layer composition
const MainLayer = Layer.mergeAll(DatabaseServiceLive, MigrationServiceLive);

// Run the migration
Effect.runPromise(
  program.pipe(
    Effect.provide(MainLayer),
    Effect.catchAll((error) =>
      Console.error("Migration failed:", error).pipe(
        Effect.andThen(Effect.fail(error)),
      ),
    ),
  ),
).catch(() => process.exit(1));
