export const ContentTable = new sst.aws.Dynamo("ContentTable", {
	fields: {
		authorId: "string",
		contentId: "string",
		createdAt: "number",
	},
	primaryIndex: { hashKey: "authorId", rangeKey: "contentId" },
	globalIndexes: {
		CreatedAtIndex: { hashKey: "authorId", rangeKey: "createdAt" },
		ContentTypeIndex: { hashKey: "contentId", rangeKey: "authorId" },
	},
});

export const UserTable = new sst.aws.Dynamo("UserTable", {
	fields: {
		id: "string",
		email: "string",
		username: "string",
	},
	primaryIndex: { hashKey: "id" },
	globalIndexes: {
		EmailIndex: { hashKey: "email" },
		UsernameIndex: { hashKey: "username" },
	},
});
