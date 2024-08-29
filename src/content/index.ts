"use server";
import fs from "node:fs";
import { z } from "zod";

type contentTypes = "micro" | "mixes" | "labels" | "words" | "authors";

export async function listFilesByContentType(
	contentType: contentTypes,
): Promise<string[]> {
	const files = fs.readdirSync(`src/content/${contentType}`);
	return files;
}

type File = {
	type: contentTypes;
	name: string;
};

export const FILE_NAME_ERROR_STRING = "String should not contain .mdx";

export async function readMarkdownFile({ type, name }: File) {
	try {
		const stringWithoutMdx = z
			.string()
			.refine((value) => !value.includes(".mdx"), {
				message: FILE_NAME_ERROR_STRING,
			});
		const validOrNah = stringWithoutMdx.safeParse(name);

		if (validOrNah.success === false) {
			return new Error(FILE_NAME_ERROR_STRING);
		}

		const validatedName = validOrNah.data;

		const file = fs.readFileSync(
			`src/content/${type}/${validatedName}.mdx`,
			"utf8",
		);
		return file;
	} catch (err) {
		return null;
	}
}
