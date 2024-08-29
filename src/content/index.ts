"use server";
import matter from "gray-matter";
import fs from "node:fs";
import { z } from "zod";
import {
	AuthorSchema,
	LabelSchema,
	MicroPostSchema,
	MixSchema,
	PostSchema,
} from "./types";

type contentDirectories = "micro" | "mixes" | "labels" | "words" | "authors";

export async function listFilesByContentType(
	contentType: contentDirectories,
): Promise<string[]> {
	const files = fs.readdirSync(`src/content/${contentType}`);
	return files;
}

type File = {
	type: contentDirectories;
	name: string;
};

export async function readMarkdownFile({ type, name }: File) {
	const FILE_NAME_ERROR_STRING = "String should not contain .mdx";
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

export async function getSlugsByContentType(type: contentDirectories) {
	const files = await listFilesByContentType(type);

	const slugs = files.map((file) => `${type}/${file.replace(".mdx", "")}`);

	return slugs;
}

type FrontMatterType<T extends contentDirectories> = T extends "micro"
	? z.infer<typeof MicroPostSchema>
	: T extends "mixes"
		? z.infer<typeof MixSchema>
		: T extends "labels"
			? z.infer<typeof LabelSchema>
			: T extends "words"
				? z.infer<typeof PostSchema>
				: T extends "authors"
					? z.infer<typeof AuthorSchema>
					: never;

export const getFrontMatter = async <T extends contentDirectories>({
	type,
	name,
}: File & { type: T }) => {
	if (!type || !name) {
		return null;
	}

	const file = await readMarkdownFile({ type, name });

	if (!file || file instanceof Error) {
		return null;
	}

	const schema = mapFrontMatterToSchema(type);

	if (!schema) {
		return null;
	}

	const frontMatter = matter(file);

	try {
		const parsedFrontMatter = schema.safeParse(frontMatter.data);
		if (parsedFrontMatter.success === false) {
			console.log("parsedFrontMatter.error:", parsedFrontMatter.error);
			return new Error(parsedFrontMatter.error.message);
		}

		return {
			...parsedFrontMatter.data,
			slug: name,
		} as FrontMatterType<T>;
	} catch (err) {
		return null;
	}
};

export const getAllFrontMatter = async <T extends contentDirectories>({
	type,
}: {
	type: T;
}) => {
	const slugs = (await getSlugsByContentType(type)).map((slug) =>
		slug.replace(`${type}/`, ""),
	);

	const frontMatter = await Promise.all(
		slugs.map((slug) => getFrontMatter({ type, name: slug })),
	);

	return frontMatter;
};

export async function getContentBody({ type, name }: File) {
	const file = await readMarkdownFile({ type, name });

	if (!file || file instanceof Error) {
		return null;
	}

	return matter(file).content;
}

const mapFrontMatterToSchema = (dir: contentDirectories) => {
	switch (dir) {
		case "micro":
			return MicroPostSchema;
		case "mixes":
			return MixSchema;
		case "labels":
			return LabelSchema;
		case "words":
			return PostSchema;
		case "authors":
			return AuthorSchema;
		default:
			return null;
	}
};
