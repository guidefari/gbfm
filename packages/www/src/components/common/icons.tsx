export const PlayIcon = () => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		fill="currentColor"
		viewBox="0 0 24 24"
		strokeWidth={1.5}
		stroke="currentColor"
		className="w-full h-full pl-1 mx-auto"
	>
		<title>Play</title>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"
		/>
	</svg>
);

export const PauseIcon = () => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		fill="none"
		viewBox="0 0 24 24"
		strokeWidth={3}
		stroke="currentColor"
		className="w-full h-full mx-auto"
	>
		<title>Pause</title>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M15.75 5.25v13.5m-7.5-13.5v13.5"
		/>
	</svg>
);

export const BackIcon = () => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		strokeWidth={2}
		className="w-full h-full mx-auto"
	>
		<title>Back</title>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z"
		/>
	</svg>
);

export const GB = () => (
	<svg
		className="w-full h-full mx-auto"
		viewBox="0 0 195 195"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<title>Logo</title>
		<path
			d="M165.966 30.9279C160.91 25.9052 154.093 23.3959 145.516 23.4H101.4V42.4268H139.146C147.607 42.4268 151.837 46.565 151.837 54.8413V139.979C151.837 148.371 147.43 152.567 138.615 152.567H101.4V171.6H145.516C154.093 171.6 160.91 169.126 165.966 164.177C171.022 159.229 173.55 152.396 173.55 143.678V51.5382C173.55 42.8289 171.022 35.9588 165.966 30.9279Z"
			fill="currentColor"
		/>
		<path
			d="M55.8501 42.4308H93.5992V23.4H49.48C40.91 23.4 34.0947 25.9098 29.0341 30.9294C23.9735 35.949 21.4452 42.8144 21.4492 51.5255V143.672C21.4492 152.384 23.9775 159.218 29.0341 164.176C34.0907 169.133 40.906 171.608 49.48 171.6H93.5992V152.575H56.3941C47.5823 152.575 43.1744 148.379 43.1704 139.985V54.8478C43.1784 46.5698 47.405 42.4308 55.8501 42.4308Z"
			fill="currentColor"
		/>
		<path
			d="M122.85 85.8001V107.25H146.25V85.8001H122.85Z"
			fill="currentColor"
		/>
		<path
			d="M93.5996 122.85H74.0996V146.25H93.5996V122.85Z"
			fill="currentColor"
		/>
		<path
			d="M142.908 183.3H52.0848C41.3784 183.289 31.1138 179.031 23.5427 171.462C15.9716 163.892 11.7123 153.629 11.6992 142.924V52.0765C11.7107 41.3704 15.9694 31.1062 23.5409 23.5365C31.1123 15.9667 41.3779 11.7098 52.0848 11.7H142.908C153.615 11.7082 163.883 15.9643 171.455 23.5343C179.028 31.1042 183.288 41.3694 183.299 52.0765V142.899C183.293 153.61 179.035 163.88 171.462 171.455C163.889 179.03 153.619 183.29 142.908 183.3V183.3ZM52.0848 13.5634C41.871 13.5748 32.0784 17.6353 24.8538 24.8547C17.6292 32.0741 13.5622 41.8634 13.5442 52.0765V142.899C13.5556 153.116 17.6198 162.912 24.8451 170.137C32.0704 177.361 41.8667 181.425 52.0848 181.437H142.908C153.121 181.425 162.914 177.365 170.139 170.145C177.363 162.926 181.43 153.137 181.448 142.924V52.0765C181.437 41.8591 177.373 32.0635 170.147 24.8388C162.922 17.614 153.126 13.5501 142.908 13.5387L52.0848 13.5634Z"
			fill="currentColor"
		/>
	</svg>
);

export const SpinningCircleLoaderThingy = () => (
	<svg
		className="w-5 h-5 mx-auto text-inherit animate-spin"
		xmlns="http://www.w3.org/2000/svg"
		fill="none"
		viewBox="0 0 24 24"
	>
		<title>Loading</title>
		<circle
			className="opacity-25"
			cx="12"
			cy="12"
			r="10"
			stroke="currentColor"
			strokeWidth="4"
		/>
		<path
			className="opacity-75"
			fill="currentColor"
			d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
		/>
	</svg>
);

export function FileTextIcon(props: React.SVGProps<SVGSVGElement>) {
	return (
		<svg
			{...props}
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<title>File Text Icon</title>
			<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
			<path d="M14 2v4a2 2 0 0 0 2 2h4" />
			<path d="M10 9H8" />
			<path d="M16 13H8" />
			<path d="M16 17H8" />
		</svg>
	);
}

export function MenuIcon(props: React.SVGProps<SVGSVGElement>) {
	return (
		<svg
			{...props}
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<title>Menu Icon</title>
			<line x1="4" x2="20" y1="12" y2="12" />
			<line x1="4" x2="20" y1="6" y2="6" />
			<line x1="4" x2="20" y1="18" y2="18" />
		</svg>
	);
}

export function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
	return (
		<svg
			{...props}
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<title>Search Icon</title>
			<circle cx="11" cy="11" r="8" />
			<path d="m21 21-4.3-4.3" />
		</svg>
	);
}

export function LockIcon(props: React.SVGProps<SVGSVGElement>) {
	return (
		<svg
			{...props}
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
			<path d="M7 11V7a5 5 0 0 1 10 0v4" />
			<title>Lock Icon</title>
		</svg>
	);
}
