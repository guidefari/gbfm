import { db } from "@/db";
import { authorsTable } from "@/db/author.schema";
import { eq } from "drizzle-orm";
import { Resource } from "sst";

type CDN_URL = string

export async function uploadAvatar(file: File): Promise<CDN_URL> {
  const { uploadToS3 } = await import("@/bucket");
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const fileName = `avatar_${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
  const bucketName = Resource.User_Content.name;
  const contentType = file.type || "application/octet-stream";
  
  await uploadToS3({
    key: fileName,
    body: fileBuffer,
    contentType,
    bucketName,
  });

  return `${Resource.Router.url}/user-content/${fileName}`;
}

export async function isUsernameAvailable(username: string) {
  const existingUser = await db
    .select()
    .from(authorsTable)
    .where(eq(authorsTable.username, username));
  return existingUser.length === 0;
}