import React from "react";
import { format, parseISO } from "date-fns";

export const LilDate = ({ date }) => {
	console.log("date:", date);
	return (
		<time dateTime={date} className="text-xs opacity-80 bg-gb-bg">
			{format(parseISO(date), "LLLL d, yyyy")}
		</time>
	);
};
