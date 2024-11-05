export const ContentTable = new sst.aws.Dynamo("ContentTable", {
	fields: {
		authorId: "string",
		contentId: "string",
		createdAt: "number",
	},
	primaryIndex: { hashKey: "authorId", rangeKey: "contentId" },
	globalIndexes: {
		CreatedAtIndex: { hashKey: "authorId", rangeKey: "createdAt" },
	},
});

export const UserTable = new sst.aws.Dynamo("UserTable", {
	fields: {
		id: "string",
		email: "string",
	},
	primaryIndex: { hashKey: "id" },
	globalIndexes: {
		EmailIndex: { hashKey: "email" },
	},
});
