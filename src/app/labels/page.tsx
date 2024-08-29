import { PageTitle } from "@/components/common/PageTitle";
import type { Metadata } from "next";
import React from "react";
import Image from "next/image";
import CustomLink from "@/components/CustomLink";
import { getAllFrontMatter } from "@/content";

export const metadata: Metadata = {
	title: "Curated Record Labels",
	description: "Some record labels we have enjoyed over the years",
};

const LabelsPage = async () => {
	// const noTemplate: Label[] = allLabels.filter(
	// 	(label: Label) => label._id !== "labels/template-label.mdx",
	// );
	const labels = await getAllFrontMatter({ type: "labels" });
	return (
		<>
			<PageTitle
				title="Record Labels"
				description="Some record labels we have enjoyed over the years"
			/>

			<div className="grid grid-cols-1 gap-4 px-4 my-4 md:grid-cols-3 lg:grid-cols-4">
				{labels.map((label) => {
					if (!label) return null;
					if (label instanceof Error) return null;
					if (label.slug === "template-label") return null;
					return (
						<CustomLink
							href={`/labels/${label.slug}`}
							as={`/labels/${label.slug}`}
							key={label.slug}
							className="flex flex-col justify-center bg-white shadow-md rounded-2xl shadow-gray-400/20"
						>
							<Image
								className="object-center w-full aspect-video rounded-t-2xl"
								src={label.thumbnailUrl || ""}
								alt={`Thumbnail image for ${label.name}`}
								width={320}
								height={320}
							/>
							<div className="p-3">
								{label.genres
									? label.genres.map((genre, index) => (
											<>
												<small
													key={`${label.name}-${index}`}
													className="text-xs text-gray-900"
												>
													{genre}
												</small>{" "}
											</>
										))
									: null}
								<h1 className="pb-2 text-2xl font-medium text-gray-700">
									{label.name}
								</h1>
							</div>
						</CustomLink>
					);
				})}
			</div>
		</>
	);
};

export default LabelsPage;
