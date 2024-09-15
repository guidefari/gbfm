import { Link, type LinkProps } from "@tanstack/react-router";

type Props = {
	children: React.ReactNode | string;
	className?: string;
	as?: string;
	href: string;
	target?: string;
	rel?: string;
} & LinkProps;

export default function CustomLink({
	as,
	href,
	children,
	className,
	...otherProps
}: Props) {
	return (
		<Link as={as} href={href} className={className} {...otherProps}>
			{children}
		</Link>
	);
}
