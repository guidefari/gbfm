import { useAuthStore } from "@/store/auth";
import type {
	AlbumApiResponse,
	PlaylistApiResponse,
	TrackAPIResponse,
} from "@/types";
import type { MDXArchiveTypes } from "@gbfm/core/mdx/mdx.types";
import type { MixSchema } from "@gbfm/vps/schemas";
import { useQuery } from "@tanstack/react-query";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
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
	const { getAccessToken } = useAuthStore.getState();
	const jwt = init.token || (await getAccessToken());
	const refreshToken = useAuthStore.getState().refreshToken;

	try {
		const isApiRequest =
			[API_BASE_URL, VPS_BASE_URL].some((base) =>
				input.toString().includes(base),
			) && !init?.skipAuth;

		const headers = {
			"Content-Type": "application/json",
			...(isApiRequest && jwt
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

		if (res.status === 401 && isApiRequest) {
			const { worker } = useAuthStore.getState();
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
			fetcher(`${API_BASE_URL}/mdx-archive/list`, {
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

export function useMixes() {
	const { data, error, isPending } = useQuery<MixSchema[], Error>({
		queryKey: ["mixes"],
		queryFn: async () => fetcher<MixSchema[]>(`${VPS_BASE_URL}/content/mixes`),
	});

	return {
		data,
		error,
		isPending,
	};
}

export function useMDXArchive(filename: string) {
	const { data, error, isLoading } = useQuery<
		MDXArchiveTypes.GrayMatter & { compiled: string }
	>({
		queryKey: ["mdx-archive", filename],
		queryFn: async () => {
			return fetcher(`${API_BASE_URL}/mdx-archive/read`, {
				method: "POST",
				body: JSON.stringify({ filename }),
			});
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
	const { data, error, isLoading } = useQuery<
		SpotifyProxyResponseType<typeof spotifyContentType>
	>({
		queryKey: ["spotify/proxy", spotifyContentType, id],

		queryFn: async () =>
			fetcher(`${API_BASE_URL}/spotify/${spotifyContentType}`, {
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

type RedirectUrl = string;

type AuthFlow = "code" | "link";

export const constructSignInUrl = (
	email: string,
	flow: AuthFlow = "code",
): RedirectUrl => {
	const origin = window.location.origin;

	const params = new URLSearchParams({
		email,
		grant_type: "authorization_code",
		client_id: "web",
		redirect_uri: `${origin}/auth/callback`,
		response_type: "code",
		provider: "code",
	}).toString();

	return `${AUTH_BASE_URL}/${flow}/authorize?${params}`;
};

export const constructAuthCallbackUrl = (code: string) => {
	return `${AUTH_BASE_URL}/code/callback?${new URLSearchParams({ code })}`;
};
