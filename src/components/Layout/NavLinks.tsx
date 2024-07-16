import { RSS } from "@/components/RSS";
import { Youtube } from "@/components/Youtube";
import { FileTextIcon, TwitterLogoIcon } from "@radix-ui/react-icons";
import { BiSolidCameraHome } from "react-icons/bi";
import { GiPerspectiveDiceSixFacesRandom } from "react-icons/gi";
import { IoIosMailOpen } from "react-icons/io";
import { PiVinylRecordLight } from "react-icons/pi";
import { SiWritedotas } from "react-icons/si";

type shit = {
	name: string;
	slug?: string;
	external?: { link: string };
	icon: React.ReactNode;
	customComponent?: React.ReactNode;
};

export const pagesAndPages: shit[] = [
	{
		name: "Words",
		slug: "/words",
		icon: <SiWritedotas className="h-5 w-5" />,
	},
	{
		name: "!Tweets",
		slug: "/micro",
		icon: (
			<>
				!<TwitterLogoIcon className="h-5 w-5" />
			</>
		),
	},
	{
		name: "Record Labels",
		slug: "/labels",
		icon: <BiSolidCameraHome className="h-5 w-5" />,
	},
	{
		name: "Mixes",
		slug: "/mixes",
		icon: <PiVinylRecordLight className="h-5 w-5" />,
	},
	{
		name: "!Newsletter",
		slug: "/newslater",
		icon: <IoIosMailOpen className="h-5 w-5" />,
	},
	{
		icon: <GiPerspectiveDiceSixFacesRandom className="h-5 w-5" />,
		name: "Random Spotify Playlist",
		slug: "/rsp",
	},
	{
		icon: <FileTextIcon className="h-5 w-5" />,
		name: "Mixes via RSS",
		customComponent: <RSS />,
	},
	{
		icon: <FileTextIcon className="h-5 w-5" />,
		name: "Mixes via Youtube",
		customComponent: <Youtube />,
	},
];
