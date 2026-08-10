CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"resource" varchar(50) NOT NULL,
	"action" varchar(50) NOT NULL,
	"description" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"roleId" uuid NOT NULL,
	"permissionId" uuid NOT NULL,
	"grantedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_roleId_permissionId_pk" PRIMARY KEY("roleId","permissionId")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_permissions" (
	"userId" uuid NOT NULL,
	"permissionId" uuid NOT NULL,
	"grantedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"grantedBy" uuid,
	CONSTRAINT "user_permissions_userId_permissionId_pk" PRIMARY KEY("userId","permissionId")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"userId" uuid NOT NULL,
	"roleId" uuid NOT NULL,
	"assignedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"assignedBy" uuid,
	CONSTRAINT "user_roles_userId_roleId_pk" PRIMARY KEY("userId","roleId")
);
--> statement-breakpoint
ALTER TABLE "audio_to_authors" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "authors" RENAME TO "users";--> statement-breakpoint
ALTER TABLE "audio_to_authors" RENAME TO "audio_creators";--> statement-breakpoint
ALTER TABLE "labels_to_authors" RENAME TO "label_creators";--> statement-breakpoint
ALTER TABLE "mixes_to_authors" RENAME TO "mix_creators";--> statement-breakpoint
ALTER TABLE "posts_to_authors" RENAME TO "post_creators";--> statement-breakpoint
ALTER TABLE "publication_authors" RENAME TO "publication_members";--> statement-breakpoint
ALTER TABLE "author_password_reset_tokens" RENAME TO "user_password_reset_tokens";--> statement-breakpoint
ALTER TABLE "author_sessions" RENAME TO "user_sessions";--> statement-breakpoint
ALTER TABLE "user_password_reset_tokens" RENAME COLUMN "authorId" TO "userId";--> statement-breakpoint
ALTER TABLE "user_sessions" RENAME COLUMN "authorId" TO "userId";--> statement-breakpoint
ALTER TABLE "audio_creators" RENAME COLUMN "authorId" TO "creatorId";--> statement-breakpoint
ALTER TABLE "label_creators" RENAME COLUMN "authorId" TO "creatorId";--> statement-breakpoint
ALTER TABLE "mix_creators" RENAME COLUMN "authorId" TO "creatorId";--> statement-breakpoint
ALTER TABLE "post_creators" RENAME COLUMN "authorId" TO "creatorId";--> statement-breakpoint
ALTER TABLE "publication_members" RENAME COLUMN "authorId" TO "userId";--> statement-breakpoint
ALTER TABLE "user_password_reset_tokens" DROP CONSTRAINT "author_password_reset_tokens_token_unique";--> statement-breakpoint
ALTER TABLE "user_sessions" DROP CONSTRAINT "author_sessions_refreshToken_unique";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "authors_username_unique";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "authors_email_unique";--> statement-breakpoint
ALTER TABLE "user_password_reset_tokens" DROP CONSTRAINT "author_password_reset_tokens_authorId_authors_id_fk";
--> statement-breakpoint
ALTER TABLE "user_sessions" DROP CONSTRAINT "author_sessions_authorId_authors_id_fk";
--> statement-breakpoint
ALTER TABLE "audio_creators" DROP CONSTRAINT "audio_to_authors_audioId_audio_id_fk";
--> statement-breakpoint
ALTER TABLE "audio_creators" DROP CONSTRAINT "audio_to_authors_authorId_authors_id_fk";
--> statement-breakpoint
ALTER TABLE "label_creators" DROP CONSTRAINT "labels_to_authors_labelId_labels_id_fk";
--> statement-breakpoint
ALTER TABLE "label_creators" DROP CONSTRAINT "labels_to_authors_authorId_authors_id_fk";
--> statement-breakpoint
ALTER TABLE "mix_creators" DROP CONSTRAINT "mixes_to_authors_mixId_mixes_id_fk";
--> statement-breakpoint
ALTER TABLE "mix_creators" DROP CONSTRAINT "mixes_to_authors_authorId_authors_id_fk";
--> statement-breakpoint
ALTER TABLE "post_creators" DROP CONSTRAINT "posts_to_authors_postId_posts_id_fk";
--> statement-breakpoint
ALTER TABLE "post_creators" DROP CONSTRAINT "posts_to_authors_authorId_authors_id_fk";
--> statement-breakpoint
ALTER TABLE "publication_members" DROP CONSTRAINT "publication_authors_publicationId_publications_id_fk";
--> statement-breakpoint
ALTER TABLE "publication_members" DROP CONSTRAINT "publication_authors_authorId_authors_id_fk";
--> statement-breakpoint
ALTER TABLE "audio_creators" DROP CONSTRAINT "audio_to_authors_audioId_authorId_pk";--> statement-breakpoint
ALTER TABLE "label_creators" DROP CONSTRAINT "labels_to_authors_labelId_authorId_pk";--> statement-breakpoint
ALTER TABLE "mix_creators" DROP CONSTRAINT "mixes_to_authors_mixId_authorId_pk";--> statement-breakpoint
ALTER TABLE "post_creators" DROP CONSTRAINT "posts_to_authors_postId_authorId_pk";--> statement-breakpoint
ALTER TABLE "audio_creators" ADD CONSTRAINT "audio_creators_audioId_creatorId_pk" PRIMARY KEY("audioId","creatorId");--> statement-breakpoint
ALTER TABLE "label_creators" ADD CONSTRAINT "label_creators_labelId_creatorId_pk" PRIMARY KEY("labelId","creatorId");--> statement-breakpoint
ALTER TABLE "mix_creators" ADD CONSTRAINT "mix_creators_mixId_creatorId_pk" PRIMARY KEY("mixId","creatorId");--> statement-breakpoint
ALTER TABLE "post_creators" ADD CONSTRAINT "post_creators_postId_creatorId_pk" PRIMARY KEY("postId","creatorId");--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_roles_id_fk" FOREIGN KEY ("roleId") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_permissions_id_fk" FOREIGN KEY ("permissionId") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permissionId_permissions_id_fk" FOREIGN KEY ("permissionId") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_grantedBy_users_id_fk" FOREIGN KEY ("grantedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_roles_id_fk" FOREIGN KEY ("roleId") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assignedBy_users_id_fk" FOREIGN KEY ("assignedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_password_reset_tokens" ADD CONSTRAINT "user_password_reset_tokens_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_creators" ADD CONSTRAINT "audio_creators_audioId_audio_id_fk" FOREIGN KEY ("audioId") REFERENCES "public"."audio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_creators" ADD CONSTRAINT "audio_creators_creatorId_users_id_fk" FOREIGN KEY ("creatorId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "label_creators" ADD CONSTRAINT "label_creators_labelId_labels_id_fk" FOREIGN KEY ("labelId") REFERENCES "public"."labels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "label_creators" ADD CONSTRAINT "label_creators_creatorId_users_id_fk" FOREIGN KEY ("creatorId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mix_creators" ADD CONSTRAINT "mix_creators_mixId_mixes_id_fk" FOREIGN KEY ("mixId") REFERENCES "public"."mixes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mix_creators" ADD CONSTRAINT "mix_creators_creatorId_users_id_fk" FOREIGN KEY ("creatorId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_creators" ADD CONSTRAINT "post_creators_postId_posts_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_creators" ADD CONSTRAINT "post_creators_creatorId_users_id_fk" FOREIGN KEY ("creatorId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_members" ADD CONSTRAINT "publication_members_publicationId_publications_id_fk" FOREIGN KEY ("publicationId") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_members" ADD CONSTRAINT "publication_members_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");--> statement-breakpoint
ALTER TABLE "user_password_reset_tokens" ADD CONSTRAINT "user_password_reset_tokens_token_unique" UNIQUE("token");--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_refreshToken_unique" UNIQUE("refreshToken");