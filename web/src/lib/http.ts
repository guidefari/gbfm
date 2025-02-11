import type { MDXArchiveTypes } from "@gbfm/core/mdx/mdx.types";
import type {
	AlbumApiResponse,
	PlaylistApiResponse,
	TrackAPIResponse,
} from "@/types";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@openauthjs/openauth/client";
import { toast } from "@/components/ui/use-toast";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
export const AUTH_BASE_URL = import.meta.env.VITE_AUTH_BASE_URL;

export const AuthClient_Frontend = createClient({
	clientID: "gbfm-www",
	issuer: AUTH_BASE_URL,
});

let accessToken: string;

export async function getToken() {
	if (accessToken) return accessToken;

	const refresh = localStorage.getItem("refresh");
	if (!refresh) return;
	const next = await AuthClient_Frontend.refresh(refresh, {
		access: accessToken,
	});
	if (next.err) return;
	if (!next.tokens) return accessToken;

	localStorage.setItem("refresh", next.tokens.refresh);
	accessToken = next.tokens.access;

	return next.tokens.access;
}

type CustomRequestInit = RequestInit & {
	skipAuth?: boolean;
};

export async function fetcher<T>(
	input: RequestInfo,
	init: CustomRequestInit = { skipAuth: true },
) {
	try {
		let sessionToken: string | undefined;
		const isApiRequest =
			input.toString().includes(API_BASE_URL) && !init?.skipAuth;

		if (isApiRequest) {
			sessionToken = await getToken();
		}

		const headers = {
			"Content-Type": "application/json",
			...(isApiRequest && sessionToken
				? { Authorization: `Bearer ${sessionToken}` }
				: {}),
		};

		let res = await fetch(input, {
			...init,
			headers,
		});

		if (res.status === 401 && isApiRequest) {
			sessionToken = await getToken();
			if (sessionToken) {
				const retryHeaders = {
					...headers,
					Authorization: `Bearer ${sessionToken}`,
				};
				res = await fetch(input, {
					...init,
					headers: retryHeaders,
				});
			}
		}

		return res.json() as Promise<T>;
	} catch (error) {
		console.error(error);
		throw error;
	}
}

export async function AuthCallback(code: string, state: string) {
	const challenge = JSON.parse(sessionStorage.getItem("challenge") ?? "");
	if (!challenge) {
		toast({
			title: "No challenge found",
			description: "Please try again",
		});
		return;
	}

	if (code) {
		if (state === challenge.state && challenge.verifier) {
			const exchanged = await AuthClient_Frontend.exchange(
				code,
				`${location.origin}/auth/callback`,
				challenge.verifier,
			);
			if (!exchanged.err) {
				accessToken = exchanged.tokens?.access;
				localStorage.setItem("refresh", exchanged.tokens.refresh);
			}
		}
		window.location.replace("/");
	}
}

export async function login() {
	const token = await getToken();
	if (!token) {
		const { challenge, url } = await AuthClient_Frontend.authorize(
			`${location.origin}/auth/callback`,
			"code",
			{
				pkce: true,
			},
		);
		sessionStorage.setItem("challenge", JSON.stringify(challenge));
		location.href = url;
	}
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
		isPending
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
