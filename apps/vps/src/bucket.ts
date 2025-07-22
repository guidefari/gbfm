import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const s3 = new S3Client({});

type UploadOptions = {
	key: string;
	body: Buffer | Uint8Array | Blob | string;
	contentType: string;
	bucketName: string;
};

export async function uploadToS3({
	key,
	body,
	contentType,
	bucketName,
}: UploadOptions): Promise<string> {
	await s3.send(
		new PutObjectCommand({
			Bucket: bucketName,
			Key: key,
			Body: body,
			ContentType: contentType,
		}),
	);
	// Don't return the direct S3 URL, as it won't work with the router
	// The actual URL will be constructed in the calling code using Resource.BucketRouter.url
	return key;
}

export { s3 };
