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

	const AlbumTrackSchema = TrackSchema.omit({
		albumType: true,
		albumImageUrl: true,
	});

	export const AlbumSchema = z.object({
		albumType: z.string().optional(),
		albumImageUrl: z.string().optional(),
		title: z.string().optional(),
		artists: z.string().optional(),
		tracks: z.array(AlbumTrackSchema),
		albumUrl: z.string(),
	});

	export type AlbumTrack = z.infer<typeof AlbumTrackSchema>;
	export type Album = z.infer<typeof AlbumSchema>;

	export const PlaylistSchema = z.object({
		coverImageUrl: z.string(),
		title: z.string(),
		description: z.string(),
		tracks: z.array(TrackSchema),
		ownerName: z.string(),
		playlistUrl: z.string(),
	});

	export type Playlist = z.infer<typeof PlaylistSchema>;
}
