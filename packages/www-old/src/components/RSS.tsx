"use client";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { CheckIcon } from "@radix-ui/react-icons";
import * as Sentry from "@sentry/nextjs";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { FaSquareRss } from "react-icons/fa6";

export const RSS = () => {
	const [isCopied, setIsCopied] = useState(false);
	const basePath = process.env.basePath;
	console.log("basePath:", basePath);
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
					<div className="flex items-center justify-center w-5 h-5">
						{isCopied ? (
							<CheckIcon className="w-full h-full text-orange-300 cursor-pointer" />
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
