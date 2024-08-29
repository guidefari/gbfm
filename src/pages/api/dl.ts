import type { NextApiRequest, NextApiResponse } from "next";
import fetch from "node-fetch";
import * as Sentry from "@sentry/nextjs";

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	// Get the URL of the file to download from the query parameters or request body
	const { fileUrl, title } = req.query;
	console.log("title:", title);

	try {
		// Download the file using the fetch function
		const response = await fetch(fileUrl as string);
		console.log("response:", response.headers.get("Content-Length"));

		// Set the appropriate headers for file downloading
		res.setHeader("Content-Type", "audio/mp3");
		res.setHeader("Content-Disposition", `attachment; filename=${title}`);
		const contentLength = response.headers.get("Content-Length");
		if (contentLength) {
			res.setHeader("Content-Length", contentLength);
		}

		// Return the downloaded file as the response body
		if (response.body) {
			response.body.pipe(res);
		} else {
			throw new Error("Response body is null");
		}
	} catch (error) {
		Sentry.captureException(error);
		res.status(500).json({ error: "Failed to download file" });
	}
}
