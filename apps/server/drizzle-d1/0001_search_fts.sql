CREATE VIRTUAL TABLE `audio_fts` USING fts5(`title`, `description`, `content`, `tags`, tokenize='trigram');
--> statement-breakpoint
CREATE VIRTUAL TABLE `posts_fts` USING fts5(`title`, `description`, `content`, `tags`, tokenize='trigram');
--> statement-breakpoint
CREATE VIRTUAL TABLE `shows_fts` USING fts5(`title`, `description`, `content`, `tags`, tokenize='trigram');
--> statement-breakpoint
CREATE TRIGGER `audio_fts_insert` AFTER INSERT ON `audio` BEGIN
  INSERT INTO `audio_fts`(rowid, title, description, content, tags)
  VALUES (new.rowid, new.title, new.description, new.content, COALESCE((SELECT group_concat(name, ' ') FROM (SELECT labels.name FROM entity_labels INNER JOIN labels ON labels.id = entity_labels.label_id WHERE entity_labels.entity_type = 'audio' AND entity_labels.entity_id = new.id AND labels.kind = 'tag' ORDER BY labels.name)), ''));
END;
--> statement-breakpoint
CREATE TRIGGER `audio_fts_update` AFTER UPDATE OF `title`, `description`, `content` ON `audio` BEGIN
  DELETE FROM `audio_fts` WHERE rowid = old.rowid;
  INSERT INTO `audio_fts`(rowid, title, description, content, tags)
  VALUES (new.rowid, new.title, new.description, new.content, COALESCE((SELECT group_concat(name, ' ') FROM (SELECT labels.name FROM entity_labels INNER JOIN labels ON labels.id = entity_labels.label_id WHERE entity_labels.entity_type = 'audio' AND entity_labels.entity_id = new.id AND labels.kind = 'tag' ORDER BY labels.name)), ''));
END;
--> statement-breakpoint
CREATE TRIGGER `audio_fts_delete` AFTER DELETE ON `audio` BEGIN
  DELETE FROM `audio_fts` WHERE rowid = old.rowid;
END;
--> statement-breakpoint
CREATE TRIGGER `posts_fts_insert` AFTER INSERT ON `posts` BEGIN
  INSERT INTO `posts_fts`(rowid, title, description, content, tags)
  VALUES (new.rowid, new.title, new.description, new.content, COALESCE((SELECT group_concat(name, ' ') FROM (SELECT labels.name FROM entity_labels INNER JOIN labels ON labels.id = entity_labels.label_id WHERE entity_labels.entity_type = 'post' AND entity_labels.entity_id = new.id AND labels.kind = 'tag' ORDER BY labels.name)), ''));
END;
--> statement-breakpoint
CREATE TRIGGER `posts_fts_update` AFTER UPDATE OF `title`, `description`, `content` ON `posts` BEGIN
  DELETE FROM `posts_fts` WHERE rowid = old.rowid;
  INSERT INTO `posts_fts`(rowid, title, description, content, tags)
  VALUES (new.rowid, new.title, new.description, new.content, COALESCE((SELECT group_concat(name, ' ') FROM (SELECT labels.name FROM entity_labels INNER JOIN labels ON labels.id = entity_labels.label_id WHERE entity_labels.entity_type = 'post' AND entity_labels.entity_id = new.id AND labels.kind = 'tag' ORDER BY labels.name)), ''));
END;
--> statement-breakpoint
CREATE TRIGGER `posts_fts_delete` AFTER DELETE ON `posts` BEGIN
  DELETE FROM `posts_fts` WHERE rowid = old.rowid;
END;
--> statement-breakpoint
CREATE TRIGGER `shows_fts_insert` AFTER INSERT ON `shows` BEGIN
  INSERT INTO `shows_fts`(rowid, title, description, content, tags)
  VALUES (new.rowid, new.title, new.description, new.content, COALESCE((SELECT group_concat(name, ' ') FROM (SELECT labels.name FROM entity_labels INNER JOIN labels ON labels.id = entity_labels.label_id WHERE entity_labels.entity_type = 'show' AND entity_labels.entity_id = new.id AND labels.kind = 'tag' ORDER BY labels.name)), ''));
END;
--> statement-breakpoint
CREATE TRIGGER `shows_fts_update` AFTER UPDATE OF `title`, `description`, `content` ON `shows` BEGIN
  DELETE FROM `shows_fts` WHERE rowid = old.rowid;
  INSERT INTO `shows_fts`(rowid, title, description, content, tags)
  VALUES (new.rowid, new.title, new.description, new.content, COALESCE((SELECT group_concat(name, ' ') FROM (SELECT labels.name FROM entity_labels INNER JOIN labels ON labels.id = entity_labels.label_id WHERE entity_labels.entity_type = 'show' AND entity_labels.entity_id = new.id AND labels.kind = 'tag' ORDER BY labels.name)), ''));
END;
--> statement-breakpoint
CREATE TRIGGER `shows_fts_delete` AFTER DELETE ON `shows` BEGIN
  DELETE FROM `shows_fts` WHERE rowid = old.rowid;
END;
--> statement-breakpoint
CREATE TRIGGER `entity_labels_audio_fts_insert` AFTER INSERT ON `entity_labels` WHEN new.entity_type = 'audio' BEGIN
  DELETE FROM `audio_fts` WHERE rowid = (SELECT rowid FROM audio WHERE id = new.entity_id);
  INSERT INTO `audio_fts`(rowid, title, description, content, tags) SELECT audio.rowid, audio.title, audio.description, audio.content, COALESCE((SELECT group_concat(name, ' ') FROM (SELECT labels.name FROM entity_labels INNER JOIN labels ON labels.id = entity_labels.label_id WHERE entity_labels.entity_type = 'audio' AND entity_labels.entity_id = new.entity_id AND labels.kind = 'tag' ORDER BY labels.name)), '') FROM audio WHERE audio.id = new.entity_id;
END;
--> statement-breakpoint
CREATE TRIGGER `entity_labels_audio_fts_delete` AFTER DELETE ON `entity_labels` WHEN old.entity_type = 'audio' BEGIN
  DELETE FROM `audio_fts` WHERE rowid = (SELECT rowid FROM audio WHERE id = old.entity_id);
  INSERT INTO `audio_fts`(rowid, title, description, content, tags) SELECT audio.rowid, audio.title, audio.description, audio.content, COALESCE((SELECT group_concat(name, ' ') FROM (SELECT labels.name FROM entity_labels INNER JOIN labels ON labels.id = entity_labels.label_id WHERE entity_labels.entity_type = 'audio' AND entity_labels.entity_id = old.entity_id AND labels.kind = 'tag' ORDER BY labels.name)), '') FROM audio WHERE audio.id = old.entity_id;
END;
--> statement-breakpoint
CREATE TRIGGER `entity_labels_audio_fts_update` AFTER UPDATE OF `entity_type`, `entity_id`, `label_id` ON `entity_labels` WHEN old.entity_type = 'audio' OR new.entity_type = 'audio' BEGIN
  DELETE FROM `audio_fts` WHERE rowid IN (SELECT rowid FROM audio WHERE id IN (old.entity_id, new.entity_id));
  INSERT INTO `audio_fts`(rowid, title, description, content, tags) SELECT audio.rowid, audio.title, audio.description, audio.content, COALESCE((SELECT group_concat(name, ' ') FROM (SELECT labels.name FROM entity_labels INNER JOIN labels ON labels.id = entity_labels.label_id WHERE entity_labels.entity_type = 'audio' AND entity_labels.entity_id = audio.id AND labels.kind = 'tag' ORDER BY labels.name)), '') FROM audio WHERE audio.id IN (old.entity_id, new.entity_id);
END;
--> statement-breakpoint
CREATE TRIGGER `entity_labels_posts_fts_insert` AFTER INSERT ON `entity_labels` WHEN new.entity_type = 'post' BEGIN
  DELETE FROM `posts_fts` WHERE rowid = (SELECT rowid FROM posts WHERE id = new.entity_id);
  INSERT INTO `posts_fts`(rowid, title, description, content, tags) SELECT posts.rowid, posts.title, posts.description, posts.content, COALESCE((SELECT group_concat(name, ' ') FROM (SELECT labels.name FROM entity_labels INNER JOIN labels ON labels.id = entity_labels.label_id WHERE entity_labels.entity_type = 'post' AND entity_labels.entity_id = new.entity_id AND labels.kind = 'tag' ORDER BY labels.name)), '') FROM posts WHERE posts.id = new.entity_id;
END;
--> statement-breakpoint
CREATE TRIGGER `entity_labels_posts_fts_delete` AFTER DELETE ON `entity_labels` WHEN old.entity_type = 'post' BEGIN
  DELETE FROM `posts_fts` WHERE rowid = (SELECT rowid FROM posts WHERE id = old.entity_id);
  INSERT INTO `posts_fts`(rowid, title, description, content, tags) SELECT posts.rowid, posts.title, posts.description, posts.content, COALESCE((SELECT group_concat(name, ' ') FROM (SELECT labels.name FROM entity_labels INNER JOIN labels ON labels.id = entity_labels.label_id WHERE entity_labels.entity_type = 'post' AND entity_labels.entity_id = old.entity_id AND labels.kind = 'tag' ORDER BY labels.name)), '') FROM posts WHERE posts.id = old.entity_id;
END;
--> statement-breakpoint
CREATE TRIGGER `entity_labels_posts_fts_update` AFTER UPDATE OF `entity_type`, `entity_id`, `label_id` ON `entity_labels` WHEN old.entity_type = 'post' OR new.entity_type = 'post' BEGIN
  DELETE FROM `posts_fts` WHERE rowid IN (SELECT rowid FROM posts WHERE id IN (old.entity_id, new.entity_id));
  INSERT INTO `posts_fts`(rowid, title, description, content, tags) SELECT posts.rowid, posts.title, posts.description, posts.content, COALESCE((SELECT group_concat(name, ' ') FROM (SELECT labels.name FROM entity_labels INNER JOIN labels ON labels.id = entity_labels.label_id WHERE entity_labels.entity_type = 'post' AND entity_labels.entity_id = posts.id AND labels.kind = 'tag' ORDER BY labels.name)), '') FROM posts WHERE posts.id IN (old.entity_id, new.entity_id);
END;
--> statement-breakpoint
CREATE TRIGGER `entity_labels_shows_fts_insert` AFTER INSERT ON `entity_labels` WHEN new.entity_type = 'show' BEGIN
  DELETE FROM `shows_fts` WHERE rowid = (SELECT rowid FROM shows WHERE id = new.entity_id);
  INSERT INTO `shows_fts`(rowid, title, description, content, tags) SELECT shows.rowid, shows.title, shows.description, shows.content, COALESCE((SELECT group_concat(name, ' ') FROM (SELECT labels.name FROM entity_labels INNER JOIN labels ON labels.id = entity_labels.label_id WHERE entity_labels.entity_type = 'show' AND entity_labels.entity_id = new.entity_id AND labels.kind = 'tag' ORDER BY labels.name)), '') FROM shows WHERE shows.id = new.entity_id;
END;
--> statement-breakpoint
CREATE TRIGGER `entity_labels_shows_fts_delete` AFTER DELETE ON `entity_labels` WHEN old.entity_type = 'show' BEGIN
  DELETE FROM `shows_fts` WHERE rowid = (SELECT rowid FROM shows WHERE id = old.entity_id);
  INSERT INTO `shows_fts`(rowid, title, description, content, tags) SELECT shows.rowid, shows.title, shows.description, shows.content, COALESCE((SELECT group_concat(name, ' ') FROM (SELECT labels.name FROM entity_labels INNER JOIN labels ON labels.id = entity_labels.label_id WHERE entity_labels.entity_type = 'show' AND entity_labels.entity_id = old.entity_id AND labels.kind = 'tag' ORDER BY labels.name)), '') FROM shows WHERE shows.id = old.entity_id;
END;
--> statement-breakpoint
CREATE TRIGGER `entity_labels_shows_fts_update` AFTER UPDATE OF `entity_type`, `entity_id`, `label_id` ON `entity_labels` WHEN old.entity_type = 'show' OR new.entity_type = 'show' BEGIN
  DELETE FROM `shows_fts` WHERE rowid IN (SELECT rowid FROM shows WHERE id IN (old.entity_id, new.entity_id));
  INSERT INTO `shows_fts`(rowid, title, description, content, tags) SELECT shows.rowid, shows.title, shows.description, shows.content, COALESCE((SELECT group_concat(name, ' ') FROM (SELECT labels.name FROM entity_labels INNER JOIN labels ON labels.id = entity_labels.label_id WHERE entity_labels.entity_type = 'show' AND entity_labels.entity_id = shows.id AND labels.kind = 'tag' ORDER BY labels.name)), '') FROM shows WHERE shows.id IN (old.entity_id, new.entity_id);
END;
--> statement-breakpoint
INSERT INTO `audio_fts`(rowid, title, description, content, tags) SELECT audio.rowid, audio.title, audio.description, audio.content, COALESCE((SELECT group_concat(name, ' ') FROM (SELECT labels.name FROM entity_labels INNER JOIN labels ON labels.id = entity_labels.label_id WHERE entity_labels.entity_type = 'audio' AND entity_labels.entity_id = audio.id AND labels.kind = 'tag' ORDER BY labels.name)), '') FROM audio;
--> statement-breakpoint
INSERT INTO `posts_fts`(rowid, title, description, content, tags) SELECT posts.rowid, posts.title, posts.description, posts.content, COALESCE((SELECT group_concat(name, ' ') FROM (SELECT labels.name FROM entity_labels INNER JOIN labels ON labels.id = entity_labels.label_id WHERE entity_labels.entity_type = 'post' AND entity_labels.entity_id = posts.id AND labels.kind = 'tag' ORDER BY labels.name)), '') FROM posts;
--> statement-breakpoint
INSERT INTO `shows_fts`(rowid, title, description, content, tags) SELECT shows.rowid, shows.title, shows.description, shows.content, COALESCE((SELECT group_concat(name, ' ') FROM (SELECT labels.name FROM entity_labels INNER JOIN labels ON labels.id = entity_labels.label_id WHERE entity_labels.entity_type = 'show' AND entity_labels.entity_id = shows.id AND labels.kind = 'tag' ORDER BY labels.name)), '') FROM shows;
