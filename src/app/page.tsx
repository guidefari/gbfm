import { PageSEO } from "src/components/SEO";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Index() {
	const router = useRouter();

	useEffect(() => {
		function letsGo() {
			router.push("/words");
		}
		letsGo();
	});

	return (
		<>
			<PageSEO
				title="goosebumps.fm"
				description="Curated Music & the occasional prose"
			/>
			{/* <Tabs /> */}
		</>
	);
}
