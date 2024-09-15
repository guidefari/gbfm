"use client";
import type React from "react";
import { MinimalCard } from "./common/MinimalCard";
import { useSpotifyProxy } from "@/lib/http";

interface Props {
	url: string;
	genres?: string[];
	blurb?: string;
	children?: React.ReactNode;
}

export default function Track({ url, genres, blurb, children }: Props) {
	const encoded = encodeURIComponent(url);

	const { data, error, isLoading } = useSpotifyProxy({
		id: encoded,
		spotifyContentType: "track",
	});

	return (
		<div>
			<MinimalCard
				key={url}
				loading={isLoading}
				blurb={blurb || ""}
				imageUrl={data?.albumImageUrl || ""}
				title={data?.title || ""}
				artists={data?.artists || ""}
				genres={genres || null}
				previewUrl={data?.previewUrl || ""}
			>
				{children}
			</MinimalCard>
		</div>
	);
}

export { Track };
