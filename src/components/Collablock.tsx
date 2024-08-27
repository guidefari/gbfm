import type React from "react";

interface Props {
	title: string;
	children: React.ReactNode;
}

export const Collablock: React.FC<Props> = ({ title, children }) => (
	<div className="mb-10">
		<h3 className="flex items-center mb-4 text-xl font-medium underline ">
			{title}
		</h3>
		<p>{children}</p>
	</div>
);
