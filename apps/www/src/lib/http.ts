import { useAuthStore, User } from "@/store/auth";
import type {
	AlbumApiResponse,
	PlaylistApiResponse,
	TrackAPIResponse,
} from "@/types";
import type { MDXArchiveTypes } from "@gbfm/core/mdx/mdx.types";
import { useQuery } from "@tanstack/react-query";
import type { SelectAudio } from "@gbfm/vps/schemas";

export const VPS_BASE_URL = import.meta.env.VITE_VPS_BASE_URL;
export const AUTH_BASE_URL = `${VPS_BASE_URL}/auth`;

type CustomRequestInit = RequestInit & {
	skipAuth?: boolean;
	token?: string;
};

export async function fetcher<T>(
	input: RequestInfo,
	init: CustomRequestInit = { skipAuth: true },
) {
	const { accessToken, refreshToken } = useAuthStore.getState();
	const jwt = init.token || accessToken;

	try {

		const headers = {
			"Content-Type": "application/json",
			...(jwt
				? {
						Authorization: `Bearer ${jwt}`,
						"Refresh-Token": refreshToken || "",
					}
				: {}),
		};

		let res = await fetch(input, {
			...init,
			headers,
		});

		if (res.status === 401) {
			console.log("401, attempting to refresh token")
			const { worker } = useAuthStore.getState();
			console.log('worker:', worker)
			if (worker) {
				const newToken = await new Promise<string | null>((resolve) => {
					const handleMessage = (event: MessageEvent) => {
						if (event.data.type === "ACCESS_TOKEN") {
							worker.removeEventListener("message", handleMessage);
							resolve(event.data.payload?.accessToken || null);
						}
					};

					worker.addEventListener("message", handleMessage);
					worker.postMessage({ type: "REFRESH_TOKEN" });
				});

				if (newToken) {
					const retryHeaders = {
						...headers,
						Authorization: `Bearer ${newToken}`,
					};
					res = await fetch(input, {
						...init,
						headers: retryHeaders,
					});
				}
			} else {
				console.log('no worker, initializing worker')
			}
		}

		return res.json() as Promise<T>;
	} catch (error) {
		console.error(error);
		throw error;
	}
}

type Response<T> = {
	result: T;
};

export function useArchetype(type: MDXArchiveTypes.archetype) {
	const { data, error, isPending } = useQuery<Response<string[]>, Error>({
		queryKey: ["mdx-archive", type],
		queryFn: async () =>
			fetcher(`${VPS_BASE_URL}/mdx-archive/list`, {
				method: "POST",
				body: JSON.stringify({ archetype: type }),
			}),
	});

	return {
		data: data,
		error,
		isPending,
	};
}

export function useAudioByType(type: "mix" | "track" | "misc") {
	const { data, error, isPending } = useQuery<SelectAudio[], Error>({
		queryKey: ["audio", type],
		queryFn: async () => fetcher<SelectAudio[]>(`${VPS_BASE_URL}/content/audio/${type}`),
	});

	return {
		data,
		error,
		isPending,
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
	const { data, error, isLoading } = useQuery<
		SpotifyProxyResponseType<typeof spotifyContentType>
	>({
		queryKey: ["spotify/proxy", spotifyContentType, id],

		queryFn: async () =>
			fetcher(`${VPS_BASE_URL}/spotify/${spotifyContentType}`, {
				method: "POST",
				body: JSON.stringify({ id }),
				skipAuth: true,
			}),
		staleTime: 15 * 60 * 1000,
	});
	return {
		data: data,
		isLoading,
		error,
	};
}

export function useUserLOL() {
	const { data, error, isPending } = useQuery<User, Error>({
		queryKey: ["user"],
		queryFn: async () => fetcher(`${VPS_BASE_URL}/auth/profile`),
	});

	return {
		data,
		error,
		isPending,
	};
}