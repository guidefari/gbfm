import type { User } from "./";
import type { z } from "zod";

export interface UserRepository {
	create(email: string): Promise<z.infer<typeof User.UserSchema>>;
	fromID(id: string): Promise<z.infer<typeof User.UserSchema> | null>;
	fromEmail(email: string): Promise<z.infer<typeof User.UserSchema> | null>;
}
