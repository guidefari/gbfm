"use client";
export const BackButton = () => {
	return (
		<button
			type="button"
			className="inline px-4 py-2 text-sm font-medium leading-5 text-white transition-colors duration-150 bg-blue-600 border border-transparent rounded-lg shadow focus:shadow-outline-blue hover:bg-blue-700 focus:outline-none dark:hover:bg-blue-500"
			onClick={() => {
				window.history.back();
			}}
		>
			Go one page back👀
		</button>
	);
};
