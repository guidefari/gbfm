import { mixesToAuthors, mixesTable } from "@/db/mix.schema";
import { db } from "@/db";
import ffmpeg from "ffmpeg-static";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import type { AppRouteHandler } from "@/lib/types";
import type { CreateRoute, ProcessUploadRoute } from "./mix.routes";

const createMix: AppRouteHandler<CreateRoute> = async (c) => {
  const { authorIds, ...mixData } = c.req.valid("json");
  try {
    const result = await db.transaction(async (tx) => {
      const [newMix] = await tx.insert(mixesTable).values(mixData).returning();
      await tx.insert(mixesToAuthors).values(
        authorIds.map((authorId: string) => ({
          mixId: newMix.id,
          authorId,
        }))
      );
      return newMix;
    });
    return c.json(result, 201);
  } catch (error) {
    if (error instanceof Error && error.message.includes("unique constraint")) {
      return c.json({ error: "Mix with this slug already exists" }, 409);
    }
    if (
      error instanceof Error &&
      error.message.includes("foreign key constraint")
    ) {
      return c.json(
        { error: "You may have entered a non-existent author id" },
        409
      );
    }
    return c.json({ error: `Failed to create mix: ${error}` }, 500);
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

async function processUploadFiles(c: any): Promise<ProcessedFiles> {
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

function formatTracklist(tracklist: string): string {
  return tracklist
    .split("\n")
    .filter((line) => line.trim() && !line.startsWith("#"))
    .map((line) => {
      const [number, artist, ...titleParts] = line
        .split("\t")
        .map((part) => part.trim());
      const title = titleParts.join(" ");
      return `${number}. ${artist} - ${title}`;
    })
    .join("\n");
}

async function createAudioOrVideo(
  files: ProcessedFiles,
  outputFormat: string
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

const processUpload: AppRouteHandler<ProcessUploadRoute> = async (c) => {
  try {
    const formData = await c.req.formData();
    const files = await processUploadFiles(c);
    const outputFormat = (formData.get("outputFormat") as string) || "mp4";
    const title = formData.get("title") as string;
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
      return c.json({ error: error.message }, 400);
    }
    return c.json({ error: "Failed to process upload" }, 500);
  }
};

export { createMix, processUpload }; 