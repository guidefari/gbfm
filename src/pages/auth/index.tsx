// redirect to /auth/signIn

import { useRouter } from "next/router";
import { useEffect } from "react";

export default function AuthIndex() {
	const router = useRouter();

	useEffect(() => {
		router.push("/auth/signin");
	}, [router]);

	return null;
}
