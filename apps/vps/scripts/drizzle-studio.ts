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
	Effect.gen(function* () {
		const configFile = target === "local" ? "drizzle.config.local.ts" : "drizzle.config.prod.ts";
		const displayTarget = target === "local" ? "Local" : "Production";

		yield* Console.log(`\n🔌 Starting Drizzle Studio for ${displayTarget} database...`);
		yield* Console.log(`   Config: ${configFile}\n`);

		const result = spawnSync("npx", ["drizzle-kit", "studio", "--config", configFile], {
			env: process.env,
			stdio: "inherit",
			shell: true,
		});

		if (result.error) {
			yield* Console.error(`❌ Failed to start Drizzle Studio: ${result.error.message}`);
			return yield* Effect.fail(result.error);
		}

		if (result.status !== 0) {
			yield* Console.error(`❌ Drizzle Studio exited with code ${result.status}`);
			return yield* Effect.die(new Error(`Process exited with code ${result.status}`));
		}

		yield* Console.log("✅ Drizzle Studio closed");
		return yield* Effect.void;
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
