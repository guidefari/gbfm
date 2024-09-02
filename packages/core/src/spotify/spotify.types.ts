import { z } from "zod";

export namespace SpotifyProxyTypes {
	export const TrackSchema = z.object({
		albumType: z.string().optional(),
		albumImageUrl: z.string().optional(),
		title: z.string().optional(),
		artists: z.string().optional(),
		trackUrl: z.string().optional(),
		previewUrl: z.string().optional(),
	});

	export type Track = z.infer<typeof TrackSchema>;
}
