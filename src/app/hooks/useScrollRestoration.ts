"use client";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const useScrollRestoration = () => {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const scrollPositions: Record<string, number> = {};

	const handleRouteChange = () => {
		const currentPath = pathname + searchParams.toString();
		scrollPositions[currentPath] = window.scrollY;
	};

	const handleRouteComplete = () => {
		const currentPath = pathname + searchParams.toString();
		const scrollY = scrollPositions[currentPath] || 0;
		window.scrollTo(0, scrollY);
	};

	useEffect(() => {
		window.addEventListener("beforeunload", handleRouteChange);
		handleRouteComplete();

		return () => {
			handleRouteChange();
			window.removeEventListener("beforeunload", handleRouteChange);
		};
	}, [pathname, searchParams]);

	return scrollPositions; // Return the scrollPositions object
};

export default useScrollRestoration;
