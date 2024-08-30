import type { MDXComponents } from "mdx/types";
import { YoutubeEmbed } from "@/components/YoutubeEmbed";
import CustomLink from "@/components/CustomLink";
import Album from "@/components/Album";
import Track from "@/components/Track";
import Playlist from "@/components/Playlist";
import HorizontalScrollCards from "@/components/common/HorizontalScrollCards";
import Tracklist from "@/components/Tracklist";
import Nowplaying from "@/components/Nowplaying";

export const CustomMDXComponents = {
	a: CustomLink,
	Album,
	Track,
	Playlist,
	HorizontalScrollCards,
	Tracklist,
	Nowplaying,
	YoutubeEmbed,
};
export function useMDXComponents(components: MDXComponents): MDXComponents {
	return {
		...CustomMDXComponents,
		...components,
	};
}
