import { mixesToAuthors, mixesTable } from "@/db/mix.schema";
import { createRouter } from "@/lib/create-app";
import { db } from "@/db";
import { bodyLimit } from "hono/body-limit";
import type { FC } from "hono/jsx";
import ffmpeg from "ffmpeg-static";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import type { AppRouteHandler } from "@/lib/types";
import * as routes from "./mix.routes";
import type { CreateRoute, UploadFormRoute, ProcessUploadRoute } from "./mix.routes";

const createMix: AppRouteHandler<CreateRoute> = async (c) => {
	const { authorIds, ...mixData } = c.req.valid("json");

	try {
		const result = await db.transaction(async (tx) => {
			const [newMix] = await tx.insert(mixesTable).values(mixData).returning();

			await tx.insert(mixesToAuthors).values(
				authorIds.map((authorId: string) => ({
					mixId: newMix.id,
					authorId,
				})),
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
				409,
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

async function processUpload(c: any): Promise<ProcessedFiles> {
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

const processUpload: AppRouteHandler<ProcessUploadRoute> = async (c) => {
		try {
			const formData = await c.req.formData();
			const files = await processUpload(c);
			const outputFormat = (formData.get("outputFormat") as string) || "mp4";
			const title = formData.get("title") as string;
			const safeTitle = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();

			const outputPath = await createAudioOrVideo(files, outputFormat);
			const outputBuffer = await fs.readFile(outputPath);

			await cleanup(files);

			return new Response(outputBuffer, {
				headers: {
					"Content-Type": outputFormat === "mp3" ? "audio/mpeg" : "video/mp4",
					"Content-Disposition": `attachment; filename="${safeTitle}.${outputFormat}"`,
				},
			});
		} catch (error) {
			if (error instanceof Error) {
				return c.json({ error: error.message }, 400);
			}
			return c.json({ error: "Failed to process upload" }, 500);
		}
	};

const styles = {
	formContainer: {
		maxWidth: "600px",
		margin: "2rem auto",
		padding: "1rem",
	},
	formGroup: {
		marginBottom: "1rem",
	},
	label: {
		display: "block",
		marginBottom: "0.5rem",
	},
	inputAndTextarea: {
		width: "100%",
		padding: "0.5rem",
		marginBottom: "1rem",
	},
	button: {
		background: "#0070f3",
		color: "white",
		padding: "0.5rem 1rem",
		border: "none",
		borderRadius: "4px",
		cursor: "pointer",
	},
};

const UploadForm: FC = () => {
	return (
		<html lang="en">
			<head>
				<title>Upload Mix</title>
			</head>
			<body>
				<div style={styles.formContainer}>
					<h1>Upload New Mix</h1>
					<form
						action="/mix/process"
						method="post"
						enctype="multipart/form-data"
					>
						<div style={styles.formGroup}>
							<label style={styles.label} for="title">
								Mix Title
							</label>
							<input
								style={styles.inputAndTextarea}
								type="text"
								id="title"
								name="title"
								required
							/>
						</div>

						<div style={styles.formGroup}>
							<label style={styles.label} for="artist">
								Artist Name (optional)
							</label>
							<input
								style={styles.inputAndTextarea}
								type="text"
								id="artist"
								name="artist"
								placeholder="Enter artist name"
							/>
						</div>
						<div style={styles.formGroup}>
							<label style={styles.label} for="album">
								Album Name (optional)
							</label>
							<input
								style={styles.inputAndTextarea}
								type="text"
								id="album"
								name="album"
								placeholder="Enter album name"
							/>
						</div>

						<div style={styles.formGroup}>
							<label style={styles.label} for="description">
								Description
							</label>
							<textarea
								style={styles.inputAndTextarea}
								id="description"
								name="description"
								rows={4}
								required
							/>
						</div>

						<div style={styles.formGroup}>
							<label style={styles.label} for="audioFile">
								Audio File
							</label>
							<input
								style={styles.inputAndTextarea}
								type="file"
								id="audioFile"
								name="audioFile"
								accept="audio/*"
								required
							/>
						</div>

						<div style={styles.formGroup}>
							<label style={styles.label} for="coverImage">
								Cover Image
							</label>
							<input
								style={styles.inputAndTextarea}
								type="file"
								id="coverImage"
								name="coverImage"
								accept="image/*"
								required
							/>
						</div>

						<div style={styles.formGroup}>
							<label style={styles.label} for="outputFormat">
								Output Format
							</label>
							<select
								style={styles.inputAndTextarea}
								id="outputFormat"
								name="outputFormat"
								required
							>
								<option value="mp4">MP4 Video</option>
								<option value="mp3">MP3 Audio</option>
							</select>
						</div>

						<button style={styles.button} type="submit">
							Upload Mix
						</button>
					</form>
				</div>
			</body>
		</html>
	);
};

const getUploadForm: AppRouteHandler<UploadFormRoute> = (c) => {
	return c.html(<UploadForm />);
};

const router = createRouter()
	.openapi(routes.create, createMix)
	.openapi(routes.uploadForm, getUploadForm)
	.post(
		"/process",
		bodyLimit({
			maxSize: 1024 * 1024 * 1000, // 1GB
			onError: (c) => {
				return c.text("bro, your file is bigger than 1GB. stop it.", 413);
			},
		}),
		processUpload,
	);

export default router;
