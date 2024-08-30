import { PageTitle } from "@/components/common/PageTitle";
import type { Metadata } from "next";
import React from "react";
import Image from "next/image";
import CustomLink from "@/components/CustomLink";
import { allLabels } from "@/contentlayer/generated";

export const metadata: Metadata = {
	title: "Curated Record Labels",
	description: "Some record labels we have enjoyed over the years",
};

const LabelsPage = async () => {
	const noTemplate = allLabels.filter(
		(label) => label._id !== "labels/template-label.mdx",
	);
	return (
		<>
			<PageTitle
				title="Record Labels"
				description="Some record labels we have enjoyed over the years"
			/>

			<div className="grid grid-cols-1 gap-4 px-4 my-4 md:grid-cols-3 lg:grid-cols-4">
				{noTemplate.map((label) => {
					return (
						<CustomLink
							href={label.url}
							as={label.url}
							key={label._id}
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
