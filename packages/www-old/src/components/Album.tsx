"use client";
import fetcher from "src/lib/fetcher";
import type { AlbumApiResponse } from "@/types";
import type React from "react";
import useSWR from "swr";
import { MultiTrack } from "./MultiTrack";

interface Props {
	url: string;
	genres?: string[];
	blurb?: string;
	children?: React.ReactNode;
}

export default function Album({ url, genres, blurb, children }: Props) {
	const encoded = encodeURIComponent(url);

	const { data, error } = useSWR<AlbumApiResponse, Error>(
		`/api/album?id=${encoded}`,
		fetcher,
	);

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
