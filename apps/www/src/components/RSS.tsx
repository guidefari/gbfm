"use client";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { CheckIcon } from "@radix-ui/react-icons";
// import * as Sentry from "@sentry/nextjs";
import { useState } from "react";
import { FaSquareRss } from "react-icons/fa6";
import { VPS_BASE_URL } from "@/lib/http";

export const RSS = () => {
	const [isCopied, setIsCopied] = useState(false);
	const RSSurl = new URL(`${VPS_BASE_URL}/rss.xml`).toString();

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
			// Sentry.captureException(error);
			console.error("Failed to copy to clipboard", error);
		}
	};

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger>
					<div className="flex justify-center items-center w-5 h-5">
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
