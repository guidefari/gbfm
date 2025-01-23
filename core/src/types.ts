export type PaginationProps = {
	page: number;
	pageSize: number;
	total: number;
};

export type Content = {
	title: string;
	contentId: string;
	content: string;
	createdAt: number;
	updatedAt: number;
	authorId: string;
	description: string;
	// genres: string[];
	// mp3Url: string;
	// youtubeId: string;
};
