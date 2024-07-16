import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { CheckIcon } from "@radix-ui/react-icons";
import * as Sentry from "@sentry/nextjs";
import { useRouter } from "next/router";
import { useState } from "react";
import { FaSquareRss } from "react-icons/fa6";

export const RSS = () => {
	const [isCopied, setIsCopied] = useState(false);
	const { basePath } = useRouter();
	const BASS = basePath ? basePath : "https://goosebumps.fm";
	const RSSurl = new URL(`${BASS}/rss.xml`).toString();

	const toggleIsCopiedForThreeSeconds = () => {
		setIsCopied(true);
		setTimeout(() => {
			setIsCopied(false);
		}, 1234);
	};

	const handleCopyToClipboard = () => {
		try {
			navigator.clipboard.writeText(RSSurl);
			toggleIsCopiedForThreeSeconds();
		} catch (error) {
			Sentry.captureException(error);
			console.error("Failed to copy to clipboard", error);
		}
	};

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger>
					<div className="flex h-6 w-6 items-center justify-center">
						{isCopied ? (
							<CheckIcon className="text-orange-300 h-full w-full cursor-pointer" />
						) : (
							<FaSquareRss
								onClick={handleCopyToClipboard}
								className="text-orange-300 cursor-pointer"
							/>
						)}
					</div>
				</TooltipTrigger>
				<TooltipContent side="right">
					{isCopied
						? "RSS link copied to clipboard"
						: "Copy RSS link to clipboard"}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
};
