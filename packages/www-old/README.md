## todo

- [ ] Video archive infrastructure
  - [ ] direct embedding from S3? instead of embedding youtube videos
- [ ] Visual arts archive
- [ ] **Add context info to Now Playing**!!
  - [x] url that you pressed play from
  - [ ] tracklist too
- [ ] View content by tag/genre
- [x] Sentry
- [x] **Virtualized list** for micro posts
  - [ ] paginated content pls😭
- [ ] context: tracklist

- [pocketbase implementation reference](https://github.com/tech-with-mahad/next-pocketbase-tutorial-1)

## Misc

- Move to Monorepo
- Move over components from the now archived project gbfm
- Postgres
- Lucia
- Hono
- Zod on FE & BE

# Entities

## User

- name:
- avatar:
- email:
- website:

## Post

- type: "full" | "micro"
- createdAt: Date
- lastModified: Date
- mood: string[]
- description
- body
- thumbnail_url

## Mood

- name

## Label

- name
- thumbnail_url
- website
- discogs
- bandcamp
- mood

## Mix

- title
- description
- date
- mp3Url
- thumbnailUrl
- author <-> user
- mood
