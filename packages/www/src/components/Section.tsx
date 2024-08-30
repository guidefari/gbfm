import type React from "react";

type Props = {
	title: string;
	children: React.ReactNode;
};

export const Section = ({ title, children }: Props) => {
	return (
		<section>
			<h2 className="my-3 text-2xl md:text-4xl">{title}</h2>
			{children}
		</section>
	);
};
