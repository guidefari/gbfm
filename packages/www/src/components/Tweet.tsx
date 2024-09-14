import type React from "react";
import { format, parseISO } from "date-fns";
import { MDXRemote } from "next-mdx-remote/rsc";
import { useInView } from "react-intersection-observer";
import { CustomMDXComponents } from "./mdx-components";
import { Link } from "@tanstack/react-router";

interface Props {
	authorName: string;
	handle: string;
	avatarUrl: string;
	date: string;
	children?: React.ReactNode;
	content: string;
	underline?: boolean;
	url: string;
}

export const Tweet: React.FC<Props> = ({
	authorName,
	children,
	date,
	handle,
	avatarUrl,
	content,
	underline = true,
	url,
}) => {
	// const { ref, inView } = useInView({
	// 	triggerOnce: true,
	// 	fallbackInView: true,
	// });
	return (
		<div
			// ref={ref}
			className="relative w-full mb-8 "
		>
			<div className="px-6 py-4 ">
				<div className="flex justify-between">
					<div className="flex items-center">
						<Link className="flex w-12 h-12 mr-3" to={`/curator/${handle}`}>
							<img
								alt={authorName}
								src={avatarUrl}
								width={48}
								height={48}
								className="rounded-full"
							/>
						</Link>
						<Link to={`/curator/${handle}`} className="flex flex-col ml-4">
							<span
								className="flex items-center font-bold leading-5 "
								title={authorName}
							>
								{authorName}
							</span>
						</Link>
					</div>
					<div className="mb-8 text-center">
						<Link to={url}>
							<time dateTime={date} className="mb-1 text-xs ">
								{format(parseISO(date), "LLLL d, yyyy")}
							</time>
						</Link>
					</div>
				</div>
				<article className="mt-4 mb-2 leading-normal prose whitespace-pre-wrap">
					{/* <MDXRemote components={CustomMDXComponents} source={content} /> */}
					{children}
				</article>
				{/* {inView ? (
					<></>
				) : (
					<div className="h-56 mb-4 bg-gray-300 rounded-lg animate-pulse" />
				)} */}
			</div>
			{underline && (
				<hr className="my-4 border-b-2 rounded-full border-gb-darker-bg border-opacity-60" />
			)}
		</div>
	);
};
