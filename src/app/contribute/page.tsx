import type { Metadata } from "next";
import { Collablock } from "src/components/Collablock";

export const metadata: Metadata = {
	keywords: ["collaborate", "goosebumps", "goosebumpsfm"],
	title: "On Contribution",
	openGraph: {
		description: "Guiding Principles to contribution",
	},
	twitter: {
		card: "summary_large_image",
		title: "On Contribution",
		description: "Guiding principles to contribution",
	},
};

export default function Collaborate() {
	return (
		<section className="">
			<div className="max-w-screen-xl px-4 mx-auto lg:px-6">
				<h2 className="mb-8 text-4xl font-extrabold tracking-tight ">
					Guiding principles
				</h2>

				<div className="grid pt-8 text-left md:gap-8 md:grid-cols-2">
					<Collablock title="Curate music for your friends">
						It should be easy to put together groups of music that you want to
						share with your friends.
					</Collablock>
					<Collablock title="Contribute to an already published post">
						A lot of stuff will be WIP. I sometimes publish pre first draft,
						because I've found immense value in early feedback from readers &
						listeners. A way you can help is by filling in a gap you see.
					</Collablock>
					<Collablock title="Long-form content, & Micro posts">
						Similar to what Substack supports. I like the idea of having
						separate spaces for long-form content, and short-form tweet sized
						thoughts.
					</Collablock>
					<Collablock title="Guest Mixes for goosebumps">
						One of the earliest forms of collaboration for this project was
						guest mixes. I still enjoy getting involved in these and will be
						more than happy to take in more submissions.
					</Collablock>
				</div>
			</div>
		</section>
	);
}
