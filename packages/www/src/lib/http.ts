import useSWR from "swr";
import type { MDXArchiveTypes } from "@gbfm/core/mdx/mdx.types";
import type { AlbumApiResponse, TrackAPIResponse } from "@/types";
import { useQuery } from "@tanstack/react-query";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function fetcher(input: RequestInfo, init?: RequestInit) {
	const res = await fetch(input, init);
	return res.json();
}

export function useUser(id: string) {
	const { data, error, isLoading } = useSWR(`/api/user/${id}`, fetcher);
	return {
		user: data,
		isLoading,
		isError: error,
	};
}

type Response<T> = {
	result: T;
};

export function useMixes() {
	const { data, error, isLoading } = useSWR<Response<string[]>, Error>(
		`${API_BASE_URL}/mdx-archive/list`,
		(input: RequestInfo) =>
			fetcher(input, {
				method: "POST",
				body: JSON.stringify({ archetype: "mixes" }),
			}),
	);
	return {
		mixes: data,
		isLoading,
		isError: error,
	};
}

// I'll likely have to move to a more fully featured network layer. tanstack/react-query. this is fine for now though.
export function useArchetype(type: MDXArchiveTypes.archetype) {
	const { data, error, isLoading, isValidating } = useSWR<
		Response<string[]>,
		Error
	>(`${API_BASE_URL}/mdx-archive/list`, (input: RequestInfo) =>
		fetcher(input, {
			method: "POST",
			body: JSON.stringify({ archetype: type }),
		}),
	);

	return {
		data: data,
		isLoading,
		error,
		isValidating,
	};
}

export function useMDXArchive(filename: string) {
	const { data, error, isLoading } = useQuery({
		queryKey: ["mdx-archive", filename],
		queryFn: async (): Promise<TrackAPIResponse> => {
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

type SpotifyProxyInput = {
	id: string;
	type: "album" | "track" | "artist" | "playlist";
};

export function useSpotifyProxy({ id, type }: SpotifyProxyInput) {
	const { data, error, isLoading } = useQuery({
		queryKey: ["spotify/proxy", type, id],
		queryFn: async (): Promise<AlbumApiResponse> => {
			const response = await fetch(`${API_BASE_URL}/spotify/${type}`, {
				method: "POST",
				body: JSON.stringify({ id }),
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
