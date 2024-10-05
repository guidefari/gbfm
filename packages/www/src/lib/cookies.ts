export namespace Cookies {
	export const sessionKey = "gbfm_session";

	export function get(key: string): string | undefined {
		const cookies = document.cookie.split("; ").reduce(
			(acc, cookie) => {
				const [k, v] = cookie.split("=");
				acc[k] = v;
				return acc;
			},
			{} as Record<string, string>,
		);
		return cookies[key];
	}

	export function set(
		key: string,
		value: string,
		options: {
			path?: string;
			expires?: Date;
			secure?: boolean;
			maxAge?: number;
			sameSite?: "lax" | "strict" | "none";
			httpOnly?: boolean;
		} = {},
	): void {
		let cookieString = `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
		if (options.expires) {
			cookieString += `; expires=${options.expires.toUTCString()}`;
		}
		if (options.path) {
			cookieString += `; path=${options.path}`;
		}
		if (options.secure) {
			cookieString += "; secure";
		}
		if (options.maxAge) {
			cookieString += `; max-age=${options.maxAge}`;
		}
		if (options.sameSite) {
			cookieString += `; sameSite=${options.sameSite}`;
		}
		if (options.httpOnly) {
			cookieString += "; httpOnly";
		}

		document.cookie = cookieString;
	}

	export function remove(key: string): void {
		document.cookie = `${encodeURIComponent(key)}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
	}
}
