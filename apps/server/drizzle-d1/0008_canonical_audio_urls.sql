UPDATE `audio`
SET `url` = replace(
	`url`,
	'https://cdn.dev.goosebumps.fm/',
	'https://cdn.goosebumps.fm/'
)
WHERE `url` LIKE 'https://cdn.dev.goosebumps.fm/%';
