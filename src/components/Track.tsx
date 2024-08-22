import fetcher from "src/lib/fetcher";
import type { TrackAPIResponse } from "@/types";
import type React from "react";
import useSWR from "swr";
import { MinimalCard } from "./common/MinimalCard";

interface Props {
	url: string;
	genres?: string[];
	blurb?: string;
	children?: React.ReactNode;
}

export default function Track({ url, genres, blurb, children }: Props) {
	const encoded = encodeURIComponent(url);

	const { data, error } = useSWR<TrackAPIResponse, Error>(
		`/api/track?id=${encoded}`,
		fetcher,
	);
	const loading = !data && !error;

	return (
		<div>
			<MinimalCard
				loading={loading}
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
