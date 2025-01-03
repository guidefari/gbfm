"use client";
import type React from "react";
import { MultiTrack } from "./MultiTrack";
import { useSpotifyProxy } from "@/lib/http";

interface Props {
	url: string;
	genres?: string[];
	blurb?: string;
	children?: React.ReactNode;
}

export default function Album({ url, genres, blurb, children }: Props) {
	const encoded = encodeURIComponent(url);

	const { data, error } = useSpotifyProxy({
		id: encoded,
		spotifyContentType: "album",
	});

	const loading = !data && !error;

	return (
		<MultiTrack
			loading={loading}
			coverImageUrl={data?.albumImageUrl || ""}
			title={data?.title || ""}
			artists={data?.artists || ""}
			tracks={data?.tracks || []}
			genres={genres}
			blurb={blurb || ""}
			url={data?.albumUrl || ""}
		>
			{children}
		</MultiTrack>
	);
}
