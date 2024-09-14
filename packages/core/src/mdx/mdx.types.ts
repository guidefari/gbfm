import { z } from "zod";

export namespace MDXArchiveTypes {
	// export const Schema = z.object({
	// 	title: z.string(),
	// 	description: z.string(),
	// 	date: z.string(),
	// 	archetype: z.enum(["mixes", "labels", "micro", "words"]),
	// });

	export const archetypeSchema = z.enum(["mixes", "labels", "micro", "words"]);
	export type archetype = z.infer<typeof archetypeSchema>;
}
