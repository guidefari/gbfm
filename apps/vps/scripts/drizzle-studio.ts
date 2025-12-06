import { Command, Options } from "@effect/cli";
import { BunContext, BunRuntime, BunFileSystem } from "@effect/platform-bun";
import { Effect, Console, Layer } from "effect";
import { spawnSync } from "child_process";

type Target = "local" | "prod";

const targetOption = Options.choice("target", ["local", "prod"]).pipe(
	Options.withDescription(
		"Database target: 'local' for development, 'prod' for production",
	),
	Options.withDefault("local" as const),
);

const createStudioEffect = (target: Target) =>
	Effect.gen(function* (_) {
		const dbStage = target === "local" ? "dev" : "prod";
		const displayTarget = target === "local" ? "Local" : "Production";

		yield* _(
			Console.log(`\n🔌 Starting Drizzle Studio for ${displayTarget} database...`),
		);
		yield* _(Console.log(`   DB_STAGE: ${dbStage}\n`));

		const env = {
			...process.env,
			DB_STAGE: dbStage,
		};

		const result = spawnSync("npx", ["drizzle-kit", "studio"], {
			env,
			stdio: "inherit",
			shell: true,
		});

		if (result.error) {
			yield* _(Console.error(`❌ Failed to start Drizzle Studio: ${result.error.message}`));
			return yield* _(Effect.fail(result.error));
		}

		if (result.status !== 0) {
			yield* _(Console.error(`❌ Drizzle Studio exited with code ${result.status}`));
			return yield* _(Effect.fail(new Error(`Process exited with code ${result.status}`)));
		}

		yield* _(Console.log("✅ Drizzle Studio closed"));
		return yield* _(Effect.succeed(undefined));
	});

const studioCommand = Command.make(
	"studio",
	{ target: targetOption },
	({ target }) => createStudioEffect(target),
).pipe(
	Command.withDescription(
		"Launch Drizzle Studio with database connection selection",
	),
);

const cli = Command.run(studioCommand, {
	name: "Drizzle Studio Launcher",
	version: "1.0.0",
});

if (import.meta.main) {
	const layers = Layer.merge(BunFileSystem.layer, BunContext.layer);
	cli(process.argv).pipe(Effect.provide(layers), BunRuntime.runMain);
}
