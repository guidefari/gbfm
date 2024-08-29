import React from "react";
import { format, parseISO } from "date-fns";

export const LilDate = ({ date }) => {
	console.log("date:", date);
	return (
		<time dateTime={date} className="text-xs opacity-80 bg-gb-bg">
			{date}
			{/* TODO: why isn't this working? */}
			{/* {format(parseISO(date), "LLLL d, yyyy")} */}
		</time>
	);
};
