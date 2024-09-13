import useSWR from "swr";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

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
