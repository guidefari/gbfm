import { describe, it, expect } from "vitest";
// import { usernameSchema, emailSchema } from '@/db/models/user/user.schema';

const PORT = process.env.PORT || 3000;
const baseURL = `http://localhost:${PORT}`;

describe("Signup validation", () => {
	it("should reject empty values", async () => {
		const empty = {
			email: "",
			username: "",
			password: "",
		};

		const response = await fetch(`${baseURL}/api/auth/signup`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(empty),
		});

		const jason = await response.json();

		expect(response.status).toBe(400);
		expect(jason.message).toContain("Missing");
	});

	it("should err on an empty username", async () => {
		const withEmptyUsername = {
			email: "guide@mail.com",
			username: "",
			password: "00o0oo0",
		};

		const response = await fetch(`${baseURL}/api/auth/signup`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(withEmptyUsername),
		});

		expect(response.status).toBe(400);
	});
});
