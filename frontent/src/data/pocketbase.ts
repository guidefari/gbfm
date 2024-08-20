import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import PocketBase from "pocketbase";
import type { GoosebumpsUser } from "../types/auth";

export const POCKET_BASE_URL =
	process.env.POCKET_BASE_URL || "http://127.0.0.1:8090";

export class DatabaseClient {
	client: PocketBase;

	constructor() {
		this.client = new PocketBase(POCKET_BASE_URL);
	}

	async authenticate(email: string, password: string) {
		try {
			const result = await this.client
				.collection("users")
				.authWithPassword(email, password);

			if (!result?.token) {
				throw new Error("Invalid email or password");
			}

			return result;
		} catch (err) {
			console.error(err);
			return err;
		}
	}

	async register(email: string, password: string) {
		try {
			const result = await this.client.collection("users").create({
				email,
				password,
				passwordConfirm: password,
			});

			return { result };
		} catch (err) {
			return err;
		}
	}

	async isAuthenticated(cookieValue: string) {
		if (!cookieValue) {
			return false;
		}

		this.client.authStore.loadFromCookie(cookieValue);
		return this.client.authStore.isValid || false;
	}

	async getUser(cookieStore: ReadonlyRequestCookies) {
		const cookie = cookieStore.get("pb_auth");
		if (!cookie) {
			return false;
		}

		this.client.authStore.loadFromCookie(cookie?.value || "");
		return this.client.authStore.model;
	}

	async updateProfile(data: GoosebumpsUser) {
		try {
			const result = await this.client
				.collection("users")
				.update(data.id, data);
			return result;
		} catch (err) {
			return err;
		}
	}
}

export const db = new DatabaseClient();

export default db;
