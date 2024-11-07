// core/src/user/index.ts
import type { UserRepository } from "./user.repository";
import { SqlUserRepository } from "./user.sql.repository";
import { DynamoUserRepository } from "./user.dynamo.repository";
import { z } from "zod";
import { fn } from "@/util/fn";

export namespace User {
	let userRepository: UserRepository | null = null;

	export const UserSchema = z.object({
		id: z.string(),
		username: z.string().min(1),
		email: z.string().email(),
		password: z.string().optional(),
		firstname: z.string().optional(),
		lastname: z.string().optional(),
		role: z.enum(["user", "admin"]).default("user"),
		isDeleted: z.boolean().default(false),
		isVerified: z.boolean().default(false),
		createdAt: z.date().default(() => new Date()),
		updatedAt: z.date().default(() => new Date()),
	});

	export type UserType = z.infer<typeof UserSchema>;
	export type PartialUser = Partial<UserType>;

	export const setUserRepository = (dbType: "sql" | "dynamo") => {
		if (dbType === "sql") {
			userRepository = new SqlUserRepository();
			return;
		}
		if (dbType === "dynamo") {
			userRepository = new DynamoUserRepository();
			return;
		}
		throw new Error("Invalid database type");
	};

	export const create = fn(UserSchema.shape.email, async (email) => {
		if (!userRepository) {
			throw new Error(
				"User repository is not initialized. Call setUserRepository first.",
			);
		}
		return userRepository.create(email);
	});

	export const fromID = fn(UserSchema.shape.id, async (id) => {
		if (!userRepository) {
			throw new Error(
				"User repository is not initialized. Call setUserRepository first.",
			);
		}
		return userRepository.fromID(id);
	});

	export const deleteByID = fn(UserSchema.shape.id, async (id) => {
		if (!userRepository) {
			throw new Error(
				"User repository is not initialized. Call setUserRepository first.",
			);
		}
		return userRepository.deleteByID(id);
	});

	export const fromEmail = fn(UserSchema.shape.email, async (email) => {
		if (!userRepository) {
			throw new Error(
				"User repository is not initialized. Call setUserRepository first.",
			);
		}
		return userRepository.fromEmail(email);
	});

	export const update = fn(UserSchema.partial(), async (user) => {
		if (!userRepository) {
			throw new Error(
				"User repository is not initialized. Call setUserRepository first.",
			);
		}
		return userRepository.update(user);
	});
}
