CREATE TABLE saved_mixes (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  url text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('youtube', 'spotify', 'soundcloud', 'mixcloud')),
  embed_url text,
  title text NOT NULL,
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'to-listen' CHECK (status IN ('to-listen', 'listening', 'listened')),
  published integer NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  created_at integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX saved_mixes_owner_url ON saved_mixes(user_id, url);
--> statement-breakpoint
CREATE INDEX saved_mixes_owner ON saved_mixes(user_id);
--> statement-breakpoint
CREATE TABLE listening_collections (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  published integer NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  created_at integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX listening_collections_owner ON listening_collections(user_id);
--> statement-breakpoint
CREATE TABLE listening_memberships (
  collection_id text NOT NULL REFERENCES listening_collections(id) ON DELETE CASCADE,
  mix_id text NOT NULL REFERENCES saved_mixes(id) ON DELETE CASCADE,
  PRIMARY KEY (collection_id, mix_id)
);
