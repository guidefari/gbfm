import { arrayContains, eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { AppRouteHandler } from "@/lib/types";

import { db } from "@/db";
import { postsTable, postsToAuthors } from "@/db/post.schema";
import { audioTable, audioToAuthors } from "@/db/audio.schema";
import ffmpeg from "ffmpeg-static";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";

import type {
  CreatePostRoute,
  GetPostsByTagRoute,
  CreateMixRoute,
  ProcessMixUploadRoute,
  GetAudioByTypeRoute,
  CreateAudioRoute,
} from "./content.routes";

export const createPost: AppRouteHandler<CreatePostRoute> = async (c) => {
  const { authorIds, ...postData } = c.req.valid("json");

  try {
    // Start a transaction since we need to insert into two tables
    const result = await db.transaction(async (tx) => {
      // Insert the post first
      const [newPost] = await tx
        .insert(postsTable)
        .values(postData)
        .returning();

      // Insert the post-author relationships
      await tx.insert(postsToAuthors).values(
        authorIds.map((authorId: string) => ({
          postId: newPost.id,
          authorId,
        })),
      );

      return newPost;
    });

    return c.json(result, HttpStatusCodes.CREATED);
  } catch (error) {
    console.error("Error creating post:", error);
    return c.json(
      { error: `Failed to create post: ${error}` },
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
};

export const getPostsByTag: AppRouteHandler<GetPostsByTagRoute> = async (c) => {
  const { tag } = c.req.valid("param");

  try {
    const posts = await db
      .select()
      .from(postsTable)
      .where(arrayContains(postsTable.tags, [tag]));

    if (!posts.length) {
      return c.json(
        { posts: [], message: "No posts found with this tag" },
        HttpStatusCodes.OK,
      );
    }

    return c.json({ posts }, HttpStatusCodes.OK);
  } catch (error) {
    console.error("Error fetching posts by tag:", error);
    return c.json(
      { error: "Failed to fetch posts" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
};

// Mix management handlers
export const createMix: AppRouteHandler<CreateMixRoute> = async (c) => {
  const { authorIds, ...mixData } = c.req.valid("json");

  try {
    const result = await db.transaction(async (tx) => {
      const [newMix] = await tx.insert(audioTable).values(mixData).returning();

      await tx.insert(audioToAuthors).values(
        authorIds.map((authorId: string) => ({
          audioId: newMix.id,
          authorId,
        })),
      );

      return newMix;
    });

    return c.json(result, HttpStatusCodes.CREATED);
  } catch (error) {
    if (error instanceof Error && error.message.includes("unique constraint")) {
      return c.json({ error: "Mix with this slug already exists" }, HttpStatusCodes.CONFLICT);
    }

    if (
      error instanceof Error &&
      error.message.includes("foreign key constraint")
    ) {
      return c.json(
        { error: "You may have entered a non-existent author id" },
        HttpStatusCodes.CONFLICT,
      );
    }

    return c.json({ error: `Failed to create mix: ${error}` }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

export const getAudioByType: AppRouteHandler<GetAudioByTypeRoute> = async (c) => {
  const { type } = c.req.valid("param");
  const audio = await db.select().from(audioTable).where(eq(audioTable.type, type));
  return c.json(audio, HttpStatusCodes.OK);
};

export const createAudio: AppRouteHandler<CreateAudioRoute> = async (c) => {
  const { authorIds, ...audioData } = c.req.valid("json");
  try {
    const result = await db.transaction(async (tx) => {
      const [newAudio] = await tx.insert(audioTable).values(audioData).returning();
      await tx.insert(audioToAuthors).values(
        authorIds.map((authorId: string) => ({
          audioId: newAudio.id,
          authorId,
        }))
      );
      return newAudio;
    });
    return c.json(result, HttpStatusCodes.CREATED);
  } catch (error) {
    if (error instanceof Error && error.message.includes("unique constraint")) {
      return c.json({ error: "Audio with this slug already exists" }, HttpStatusCodes.CONFLICT);
    }
    if (
      error instanceof Error &&
      error.message.includes("foreign key constraint")
    ) {
      return c.json(
        { error: "You may have entered a non-existent author id" },
        HttpStatusCodes.CONFLICT,
      );
    }
    return c.json({ error: `Failed to create audio: ${error}` }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

interface ProcessedFiles {
  audioPath: string;
  imagePath: string;
  outputPath: string;
  description: string;
  artist?: string;
  album?: string;
}

// Private helper, not exported
async function processUploadHelper(c: any): Promise<ProcessedFiles> {
  const formData = await c.req.formData();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mix-"));

  const audioFile = formData.get("audioFile") as File;
  const imageFile = formData.get("coverImage") as File;
  const outputFormat = formData.get("outputFormat") as string;
  const description = formData.get("description") as string;
  const artist = formData.get("artist") as string;
  const album = formData.get("album") as string;
  if (!audioFile || !imageFile) {
    throw new Error("Missing required files");
  }

  const audioBuffer = await audioFile.arrayBuffer();
  const imageBuffer = await imageFile.arrayBuffer();

  const audioPath = path.join(tmpDir, "audio.mp3");
  const imagePath = path.join(tmpDir, "cover.jpg");
  const outputPath = path.join(tmpDir, `output.${outputFormat}`);

  await fs.writeFile(audioPath, Buffer.from(audioBuffer));
  await fs.writeFile(imagePath, Buffer.from(imageBuffer));

  return { audioPath, imagePath, outputPath, description, artist, album };
}

// @ts-expect-error - don't really care about this endpoint. will fix when i need to use it🚀
export const processUpload: AppRouteHandler<ProcessMixUploadRoute> = async (c) => {
  try {
    const formData = await c.req.formData();
    const files = await processUploadHelper(c);
    const outputFormat = (formData.get("outputFormat") as string) || "mp4";
    const title = formData.get("title") as string; // <-- fix: extract title
    const safeTitle = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();

    const outputPath = await createAudioOrVideo(files, outputFormat);
    const outputBuffer = await fs.readFile(outputPath);

    await cleanup(files);

    return new Response(outputBuffer, {
      headers: {
        "Content-Type": outputFormat === "mp3" ? "audio/mpeg" : "video/mp4",
        "Content-Disposition": `attachment; filename=\"${safeTitle}.${outputFormat}\"`,
      },
    });
    
  } catch (error) {
    if (error instanceof Error) {
      return c.json({ error: error.message }, HttpStatusCodes.BAD_REQUEST);
    }
    return c.json({ error: "Failed to process upload" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

function formatTracklist(tracklist: string): string {
  return tracklist
    .split("\n")
    .filter((line) => line.trim() && !line.startsWith("#")) // Skip header and empty lines
    .map((line) => {
      const [number, artist, ...titleParts] = line
        .split("\t")
        .map((part) => part.trim());
      const title = titleParts.join(" "); // Rejoin title parts in case they contain tabs
      return `${number}. ${artist} - ${title}`;
    })
    .join("\n");
}

async function createAudioOrVideo(
  files: ProcessedFiles,
  outputFormat: string,
): Promise<string> {
  const formattedTracklist = formatTracklist(files.description);

  return new Promise((resolve, reject) => {
    const ffmpegArgs =
      outputFormat === "mp3"
        ? [
            "-i",
            files.audioPath,
            "-i",
            "public/intro.wav",
            "-i",
            files.imagePath,
            "-filter_complex",
            "[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=2[a]",
            "-c:a",
            "libmp3lame",
            "-b:a",
            "320k",
            "-map",
            "[a]",
            "-map",
            "2",
            "-c:v",
            "mjpeg",
            "-disposition:v:0",
            "attached_pic",
            "-metadata",
            "TCON=Electronic",
            ...(files.artist ? ["-metadata", `artist=${files.artist}`] : []),
            "-metadata",
            `album=${files.album || "GBFM"}`,
            "-metadata",
            `description=Tracklist:\n${formattedTracklist}`,
            "-metadata",
            `comment=Tracklist:\n${formattedTracklist}`,
            "-metadata",
            `lyrics=Tracklist:\n${formattedTracklist}`,
            "-metadata",
            `USLT=Tracklist:\n${formattedTracklist}`,
            "-id3v2_version",
            "3",
            files.outputPath,
          ]
        : [
            "-loop",
            "1",
            "-i",
            files.imagePath,
            "-i",
            files.audioPath,
            "-i",
            "public/intro.wav",
            "-filter_complex",
            "[1:a][2:a]amix=inputs=2:duration=first:dropout_transition=2[a]",
            "-c:v",
            "libx264",
            "-tune",
            "stillimage",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-pix_fmt",
            "yuv420p",
            "-shortest",
            "-vf",
            "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
            "-map",
            "0:v",
            "-map",
            "[a]",
            files.outputPath,
          ];

    const ffmpegProcess = spawn(ffmpeg as string, ffmpegArgs);

    ffmpegProcess.on("close", (code) => {
      if (code === 0) {
        resolve(files.outputPath);
      } else {
        reject(new Error(`FFmpeg process exited with code ${code}`));
      }
    });

    ffmpegProcess.stderr.on("data", (data) => {
      console.log(`FFmpeg: ${data}`);
    });
  });
}

async function cleanup(files: ProcessedFiles) {
  try {
    await fs.unlink(files.audioPath);
    await fs.unlink(files.imagePath);
    await fs.unlink(files.outputPath);
    await fs.rmdir(path.dirname(files.audioPath));
  } catch (error) {
    console.error("Cleanup error:", error);
  }
}
