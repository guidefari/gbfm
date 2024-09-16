import type { MDXArchiveTypes } from "@gbfm/core/mdx/mdx.types";
import type {
	AlbumApiResponse,
	PlaylistApiResponse,
	TrackAPIResponse,
} from "@/types";
import { useQuery } from "@tanstack/react-query";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function fetcher(input: RequestInfo, init?: RequestInit) {
	const res = await fetch(input, init);
	return res.json();
}

export function useUser(id: string) {
	const { data, error, isLoading } = useQuery({
		queryKey: ["user", id],
		queryFn: async () => fetcher(`/api/user/${id}`),
	});
	return {
		user: data,
		isLoading,
		isError: error,
	};
}

type Response<T> = {
	result: T;
};

export function useArchetype(type: MDXArchiveTypes.archetype) {
	const { data, error, isLoading } = useQuery<Response<string[]>, Error>({
		queryKey: ["mdx-archive", type],
		queryFn: async () =>
			fetcher(`${API_BASE_URL}/mdx-archive/list`, {
				method: "POST",
				body: JSON.stringify({ archetype: type }),
			}),
	});

	return {
		data: data,
		isLoading,
		error,
	};
}

export function useMDXArchive(filename: string) {
	const { data, error, isLoading } = useQuery({
		queryKey: ["mdx-archive", filename],
		queryFn: async (): Promise<
			MDXArchiveTypes.GrayMatter & { compiled: string }
		> => {
			const response = await fetch(`${API_BASE_URL}/mdx-archive/read`, {
				method: "POST",
				body: JSON.stringify({ filename }),
			});
			return await response.json();
		},
	});
	return {
		data: data,
		isLoading,
		error,
	};
}

type SpotifyContentType = "album" | "track" | "playlist";

type SpotifyProxyInput<T extends SpotifyContentType> = {
	id: string;
	spotifyContentType: T;
};

type SpotifyProxyResponseType<T> = T extends "album"
	? AlbumApiResponse
	: T extends "track"
		? TrackAPIResponse
		: T extends "playlist"
			? PlaylistApiResponse
			: never;

export function useSpotifyProxy<T extends SpotifyContentType>({
	id,
	spotifyContentType,
}: SpotifyProxyInput<T>) {
	const { data, error, isLoading } = useQuery({
		queryKey: ["spotify/proxy", spotifyContentType, id],

		queryFn: async (): Promise<
			SpotifyProxyResponseType<typeof spotifyContentType>
		> => {
			const response = await fetch(
				`${API_BASE_URL}/spotify/${spotifyContentType}`,
				{
					method: "POST",
					body: JSON.stringify({ id }),
				},
			);
			return await response.json();
		},
	});
	return {
		data: data,
		isLoading,
		error,
	};
}

type ReadSingleInput = {
	archetype: MDXArchiveTypes.archetype;
	id: string;
};

export function useReadSingle({ archetype, id }: ReadSingleInput) {
	return useQuery({
		queryKey: ["read-single", archetype, id],
		queryFn: async () =>
			fetcher(`${API_BASE_URL}/read`, {
				method: "POST",
				body: JSON.stringify({ filename: `${archetype}/${id}.mdx` }),
			}),
	});
}
