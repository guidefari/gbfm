"use client";
import { useEffect, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const useScrollRestoration = () => {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const scrollPositions: Record<string, number> = {};

	const handleRouteChange = useCallback(() => {
		if (pathname && searchParams) {
			const currentPath = pathname + searchParams.toString();
			scrollPositions[currentPath] = window.scrollY;
		}
	}, [pathname, searchParams]);

	const handleRouteComplete = useCallback(() => {
		if (pathname && searchParams) {
			const currentPath = pathname + searchParams.toString();
			const scrollY = scrollPositions[currentPath] || 0;
			window.scrollTo(0, scrollY);
		}
	}, [pathname, searchParams]);

	useEffect(() => {
		window.addEventListener("beforeunload", handleRouteChange);
		handleRouteComplete();

		return () => {
			handleRouteChange();
			window.removeEventListener("beforeunload", handleRouteChange);
		};
	}, [handleRouteChange, handleRouteComplete]);

	return scrollPositions;
};

export default useScrollRestoration;
