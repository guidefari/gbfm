"use client";
import type React from "react";
import fetcher from "src/lib/fetcher";
import useSWR from "swr";
import type { PlaylistApiResponse } from "@/types";
import { MultiTrack } from "./MultiTrack";

interface Props {
	url: string;
	genres?: string[];
	blurb?: string;
	children?: React.ReactNode;
}

export default function Playlist({ url, genres, blurb, children }: Props) {
	const encoded = encodeURIComponent(url);

	const { data, error } = useSWR<PlaylistApiResponse, Error>(
		`/api/playlist?id=${encoded}`,
		fetcher,
	);
	const loading = !data && !error;

	return (
		<MultiTrack
			loading={loading}
			coverImageUrl={data?.coverImageUrl || ""}
			title={data?.title || ""}
			artists={data?.ownerName || ""}
			tracks={data?.tracks || []}
			genres={genres}
			blurb={blurb || ""}
			url={data?.playlistUrl || ""}
		>
			{children}
		</MultiTrack>
	);
}
