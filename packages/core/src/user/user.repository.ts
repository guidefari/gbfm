import type { User } from "./";

export interface UserRepository {
	create(email: string): Promise<User.PartialUser>;
	fromID(id: string): Promise<User.UserType | null>;
	fromEmail(email: string): Promise<User.UserType | null>;
	update(user: User.PartialUser): Promise<User.PartialUser>;
	deleteByID(id: string): Promise<boolean>;
}
