import { createSessionBuilder } from "sst/auth";
import { createSubjects } from "@openauthjs/openauth";
import { z } from "zod";

export const subjects = createSubjects({
	user: z.object({
		id: z.string(),
		email: z.string(),
	}),
});
