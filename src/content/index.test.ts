import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	getFrontMatter,
	getSlugsByContentType,
	listFilesByContentType,
	readMarkdownFile,
} from ".";
import { MicroPostSchema } from "./types";
import path from "node:path";
import fs from "node:fs";

describe("listFilesByContentType", () => {
	it("should list files by content type", async () => {
		const files = await listFilesByContentType("micro");
		// expect(files).to
		// assert that files is an array
		expect(Array.isArray(files)).toBe(true);
		// assert that files is not empty
		expect(files.length).toBeGreaterThan(0);
		// assert that files is an array of strings
		expect(files.every((file) => typeof file === "string")).toBe(true);
	});

	it("should read a file", async () => {
		const file = await readMarkdownFile({ type: "micro", name: "synkro" });
		expect(file).toBeDefined();
	});

	it("return null if file does not exist", async () => {
		const file = await readMarkdownFile({
			type: "micro",
			name: "non-existent-file",
		});
		expect(file).toBeNull();
	});

	it("should return an error if I pass file name with .mdx", async () => {
		const file = await readMarkdownFile({
			type: "micro",
			name: "micro-1.mdx",
		});

		// if file is a string, then the test failed
		if (typeof file === "string") {
			// LOL, surely there's a better way to fix this.
			// big brain type shit😂
			expect(true).toBe(false);
		}

		if (typeof file !== "string") {
			expect(file).toBeInstanceOf(Error);
			expect(file?.message).toContain(".mdx");
		}
	});

	it("should return slugs by content type", async () => {
		const slugs = await getSlugsByContentType("labels");
		expect(slugs).toBeDefined();
		expect(slugs.length).toBeGreaterThan(0);
		expect(slugs.every((slug) => typeof slug === "string")).toBe(true);
	});
});

describe("getFrontMatter", () => {
	it("should return front matter", async () => {
		const frontMatter = await getFrontMatter({ type: "micro", name: "synkro" });
		expect(frontMatter).toBeDefined();
	});

	it("should return an error if the front matter is invalid", async () => {
		const tempDir = path.join(__dirname, "micro");
		const tempFile = path.join(tempDir, "invalid-frontmatter.mdx");

		if (!fs.existsSync(tempDir)) {
			fs.mkdirSync(tempDir);
		}
		fs.writeFileSync(
			tempFile,
			`---
invalidKey: value
---
Content of the file`,
		);

		const frontMatter = await getFrontMatter({
			type: "micro",
			name: "invalid-frontmatter",
		});
		expect(frontMatter).toBeInstanceOf(Error);

		fs.unlinkSync(tempFile);
	});
});
