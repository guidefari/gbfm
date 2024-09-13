import grayMatter from "gray-matter";
import { Resource } from "sst";
import {
	S3Client,
	ListObjectsV2Command,
	GetObjectCommand,
} from "@aws-sdk/client-s3";
import { MDXArchiveTypes } from "./mdx.types";

const s3 = new S3Client({});
export { MDXArchiveTypes };

export namespace MDXArchive {
	export const list = async (
		archetype: MDXArchiveTypes.archetype,
	): Promise<string[]> => {
		const objects = await s3.send(
			new ListObjectsV2Command({
				Bucket: Resource.MDX_Archive.name,
			}),
		);

		if (!objects.Contents) {
			return [];
		}

		const result =
			objects.Contents.map((object) => object.Key)
				.filter((key): key is string => {
					if (!key) return false;

					const postType = key.split("/")[0];

					if (postType !== archetype) return false;

					return !!key;
				})
				.map((key) => key.split("/").pop()?.split(".")[0] || key) || [];

		return result;
	};

	export const readOne = async (filename: string) => {
		const object = await s3.send(
			new GetObjectCommand({
				Bucket: Resource.MDX_Archive.name,
				Key: filename,
			}),
		);

		if (!object.Body) {
			return {};
		}

		const result = await object.Body.transformToString();
		const gray = grayMatter(result);

		return gray;
	};
}
