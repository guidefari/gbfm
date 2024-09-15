import { LilDate } from "../common/LilDate";
import { MinimalCard } from "../common/MinimalCard";
import { DEFAULT_IMAGE_URL } from "@/lib/constants";
import { MDXRemote } from "next-mdx-remote/rsc";
import { CustomMDXComponents } from "@/components/mdx-components";

type Props = {
	content: string;
	thumbnailUrl: string;
	title: string;
	date?: string;
	description?: string;
	youtubeId?: string;
	mp3Url?: string;
};

export const LongPost = ({
	title,
	thumbnailUrl,
	description,
	content,
	date,
	youtubeId,
	mp3Url,
}: Props) => {
	return (
		<>
			<div className="relative grid grid-flow-row md:grid-flow-col md:grid-cols-3 md:space-x-5">
				<div className="md:ml-2 mt-6 break-words rounded-md w-fit px-2 md:mx-auto md:max-w-[30%] md:fixed md:top-0 md:min-h-screen self-start md:col-span-1">
					{mp3Url ? (
						<MinimalCard
							title={title}
							previewUrl={mp3Url}
							imageUrl={thumbnailUrl ?? DEFAULT_IMAGE_URL}
							download
							hideTitle
						/>
					) : (
						<img
							className="rounded-md "
							src={thumbnailUrl || DEFAULT_IMAGE_URL}
							alt={`Thumbnail image for post titled - ${title}`}
							width={320}
							height={320}
							loading="lazy"
						/>
					)}
					<h4 className="text-left md:mx-0 text-gb-pastel-green-2">{title}</h4>
					{date && <LilDate date={date} />}
					{youtubeId && (
						<iframe
							width="100%"
							height="auto"
							src={`https://www.youtube.com/embed/${youtubeId}`}
							title="YouTube video player"
							allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
							allowFullScreen
						/>
					)}
				</div>
				<article className="min-h-screen px-2 mt-6 prose break-words md:w-auto md:px-0 md:col-start-2 md:col-span-2 lg:prose-xl">
					{description && <p className="text-left ">{description}</p>}
					{/* <MDXRemote components={CustomMDXComponents} source={content} /> */}
				</article>
			</div>
		</>
	);
};
