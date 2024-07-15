import { RSS } from "@/components/RSS";
import { Youtube } from "@/components/Youtube";

type shit = {
	name: string;
	slug?: string;
	external?: { link: string };
	icon?: React.ReactNode;
	customComponent?: React.ReactNode;
};

export const pagesAndPages: shit[] = [
	{
		name: "Words",
		slug: "/words",
	},
	{
		name: "!Tweets",
		slug: "/micro",
	},
	{
		name: "Labels",
		slug: "/labels",
	},
	{
		name: "Mixes",
		slug: "/mixes",
	},
	{
		name: "!Newsletter",
		slug: "/newslater",
	},
	{
		name: "rsp",
		slug: "/rsp",
	},
	{
		name: "RSS",
		customComponent: <RSS />,
	},
	{
		name: "Youtube",
		customComponent: <Youtube />,
	},
];
