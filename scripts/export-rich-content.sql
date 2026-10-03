SELECT 'post' AS kind, id, content FROM posts
UNION ALL
SELECT 'audio' AS kind, id, content FROM audio
UNION ALL
SELECT 'show' AS kind, id, content FROM shows
UNION ALL
SELECT 'release' AS kind, id, content FROM releases
UNION ALL
SELECT 'label' AS kind, id, content FROM music_labels
ORDER BY kind, id;
